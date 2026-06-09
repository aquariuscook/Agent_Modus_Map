import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  initProspectDb,
  saveProspect,
  saveProspectsFromRun,
  getProspect,
  listProspects,
  updateProspectStatus,
  updateProspectNotes,
  bulkUpdateStatus,
  deleteProspect,
  getStats,
  exportCSV,
  getAllProspects,
} from '../services/prospect-service.js';
import { getUserProfile } from './settings-routes.js';
import { requireCapability } from '../services/license-service.js';
import { getCheapestModel, callGenerateText, NoProviderAvailableError } from '../services/provider-router-service.js';

type ProspectStatus =
  | 'new'
  | 'contacted'
  | 'responded'
  | 'meeting'
  | 'qualified'
  | 'proposal'
  | 'won'
  | 'lost'
  | 'archived';

const VALID_STATUSES: Set<string> = new Set([
  'new', 'contacted', 'responded', 'meeting',
  'qualified', 'proposal', 'won', 'lost', 'archived',
]);

function isValidStatus(value: unknown): value is ProspectStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value);
}

export function createProspectRoutes(): Router {
  const router = Router();

  initProspectDb().catch((err) => {
    console.error('Failed to initialize prospect database:', err);
  });

  // GET /api/prospects - list with filters
  router.get('/', async (req: Request, res: Response) => {
    try {
      const filters: Record<string, unknown> = {};
      const { status, minScore, maxScore, industry, search, limit, offset } = req.query;

      if (status) filters.status = status;
      if (minScore) filters.minScore = Number(minScore);
      if (maxScore) filters.maxScore = Number(maxScore);
      if (industry) filters.industry = industry;
      if (search) filters.search = search;
      if (limit) filters.limit = Number(limit);
      if (offset) filters.offset = Number(offset);

      const prospects = await listProspects(filters);
      res.json({ data: prospects });
    } catch (err) {
      console.error('Error listing prospects:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to list prospects.' });
    }
  });

  // GET /api/prospects/stats - aggregate stats
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const stats = await getStats();
      res.json({ data: stats });
    } catch (err) {
      console.error('Error fetching prospect stats:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to fetch stats.' });
    }
  });

  // GET /api/prospects/export - download CSV
  router.get('/export', requireCapability('prospects.export'), async (_req: Request, res: Response) => {
    try {
      const csv = await exportCSV();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
      res.send(csv);
    } catch (err) {
      console.error('Error exporting prospects:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to export prospects.' });
    }
  });

  // GET /api/prospects/:id - single prospect
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const prospect = await getProspect(String(req.params.id));
      if (!prospect) {
        res.status(404).json({ error: 'not_found', message: 'Prospect not found.' });
        return;
      }
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error fetching prospect:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to fetch prospect.' });
    }
  });

  // PUT /api/prospects/:id/status - update status
  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      if (!isValidStatus(status)) {
        res.status(400).json({ error: 'validation', message: 'Invalid or missing status.' });
        return;
      }
      const prospect = await updateProspectStatus(String(req.params.id), status);
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error updating prospect status:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to update status.' });
    }
  });

  // PUT /api/prospects/:id/notes - update notes
  router.put('/:id/notes', async (req: Request, res: Response) => {
    try {
      const { notes } = req.body;
      if (typeof notes !== 'string') {
        res.status(400).json({ error: 'validation', message: 'notes must be a string.' });
        return;
      }
      const prospect = await updateProspectNotes(String(req.params.id), notes);
      res.json({ data: prospect });
    } catch (err) {
      console.error('Error updating prospect notes:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to update notes.' });
    }
  });

  // POST /api/prospects/:id/find-email - attempt to find contact email
  router.post('/:id/find-email', async (req: Request, res: Response) => {
    try {
      const prospect = await getProspect(String(req.params.id));
      if (!prospect) {
        res.status(404).json({ error: 'not_found' });
        return;
      }

      // Already have an email
      if (prospect.contactEmail && !prospect.contactEmail.includes('Not found') && prospect.contactEmail.includes('@')) {
        res.json({ data: { email: prospect.contactEmail, method: 'existing' } });
        return;
      }

      // Need a domain to search
      let domain = '';
      if (prospect.website && /^https?:\/\//.test(prospect.website)) {
        try { domain = new URL(prospect.website).hostname.replace(/^www\./, ''); } catch {}
      }
      if (!domain && prospect.linkedin) {
        // Try to extract company name for domain guess
        const slug = prospect.linkedin.split('/company/')[1]?.replace(/\/$/, '');
        if (slug) domain = slug.replace(/-/g, '') + '.com';
      }

      const contactName = prospect.contactName || '';
      const firstName = contactName.split(/\s+/)[0]?.toLowerCase() || '';
      const lastName = contactName.split(/\s+/).slice(-1)[0]?.toLowerCase() || '';

      // Method 1: Scrape the actual company website for email addresses
      const tavilyKey = process.env.TAVILY_API_KEY;
      const websiteUrl = prospect.website && /^https?:\/\//.test(prospect.website) ? prospect.website : '';

      if (tavilyKey && (websiteUrl || domain)) {
        try {
          // Try common pages where emails live
          const baseUrl = websiteUrl || `https://${domain}`;
          const urlsToTry = [
            baseUrl,
            baseUrl.replace(/\/$/, '') + '/contact',
            baseUrl.replace(/\/$/, '') + '/about',
            baseUrl.replace(/\/$/, '') + '/team',
            baseUrl.replace(/\/$/, '') + '/about-us',
            baseUrl.replace(/\/$/, '') + '/contact-us',
          ];

          console.log(`[EMAIL-FINDER] Scraping ${urlsToTry.length} pages for ${prospect.company}...`);

          const extractRes = await fetch('https://api.tavily.com/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyKey, urls: urlsToTry }),
          });

          if (extractRes.ok) {
            const extractData = await extractRes.json() as any;
            const allContent = (extractData.results || []).map((r: any) => r.raw_content || '').join('\n');

            // Extract ALL email addresses from the scraped pages
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const rawEmails: string[] = allContent.match(emailRegex) || [];
            const uniqueEmails = Array.from(new Set(rawEmails));
            const junkPatterns = ['example.com', 'sentry', 'webpack', 'wixpress', 'gravatar', 'placeholder', 'yourdomain', 'domain.com', 'email@', 'name@', 'user@', 'test@', 'info@info', 'not@', 'your@', 'someone@'];
            const foundEmails = uniqueEmails.filter(e => {
              const lower = e.toLowerCase();
              if (junkPatterns.some(j => lower.includes(j))) return false;
              if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.svg')) return false;
              if (lower.startsWith('email@') || lower.startsWith('name@')) return false;
              if (lower === 'info@address.com' || lower === 'email@address.com') return false;
              return true;
            });

            console.log(`[EMAIL-FINDER] Found ${foundEmails.length} emails on website: ${foundEmails.join(', ')}`);

            if (foundEmails.length > 0) {
              // Try to match to the contact name
              let bestEmail = foundEmails[0];
              if (firstName) {
                const nameMatch = foundEmails.find(e => e.toLowerCase().includes(firstName));
                if (nameMatch) bestEmail = nameMatch;
              }
              // Filter out generic no-reply addresses, prefer personal ones
              const personal = foundEmails.filter(e => !e.startsWith('info@') && !e.startsWith('contact@') && !e.startsWith('support@') && !e.startsWith('noreply@') && !e.startsWith('no-reply@'));
              if (personal.length > 0) {
                const nameMatch = personal.find(e => firstName && e.toLowerCase().includes(firstName));
                bestEmail = nameMatch || personal[0];
              }

              await saveProspect({ ...prospect, contactEmail: bestEmail });
              res.json({ data: { email: bestEmail, allFound: foundEmails, method: 'website-scrape' } });
              return;
            }
          }
        } catch (err) {
          console.log(`[EMAIL-FINDER] Tavily scrape failed:`, (err as Error).message);
        }
      }

      // Method 2: Search the web for their email
      if (tavilyKey) {
        try {
          const searchQuery = `"${prospect.company}" ${contactName || ''} email ${domain ? 'site:' + domain : ''} ${prospect.location || ''}`.trim();
          const searchRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: tavilyKey, query: searchQuery, max_results: 5, include_raw_content: true }),
          });

          if (searchRes.ok) {
            const searchData = await searchRes.json() as any;
            const allText = (searchData.results || []).map((r: any) => (r.content || '') + ' ' + (r.raw_content || '')).join('\n');
            const rawSearchEmails: string[] = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            const emails = Array.from(new Set(rawSearchEmails)).filter(e => !e.includes('example.com') && !e.includes('sentry'));

            if (emails.length > 0) {
              const bestEmail = (firstName ? emails.find(e => e.toLowerCase().includes(firstName)) : null) || emails[0];
              await saveProspect({ ...prospect, contactEmail: bestEmail });
              res.json({ data: { email: bestEmail, allFound: emails, method: 'web-search' } });
              return;
            }
          }
        } catch { /* fall through */ }
      }

      // Method 3: Hunter.io (if API key available)
      const hunterKey = process.env.HUNTER_API_KEY;
      if (hunterKey && domain) {
        try {
          // Step A: Domain Search - get all emails at the company
          const domainSearchUrl = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${hunterKey}&limit=10`;
          const domainRes = await fetch(domainSearchUrl);
          if (domainRes.ok) {
            const domainData = await domainRes.json() as any;
            const allEmails = (domainData.data?.emails || []).map((e: any) => ({
              email: e.value,
              firstName: e.first_name,
              lastName: e.last_name,
              position: e.position,
              confidence: e.confidence,
            }));

            if (allEmails.length > 0) {
              console.log(`[HUNTER] Domain search found ${allEmails.length} emails at ${domain}`);
              // Try to match to our contact name
              let bestMatch = allEmails[0];
              if (firstName) {
                const nameMatch = allEmails.find((e: any) => e.firstName?.toLowerCase() === firstName);
                if (nameMatch) bestMatch = nameMatch;
              }

              // Step B: Verify the email
              try {
                const verifyUrl = `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(bestMatch.email)}&api_key=${hunterKey}`;
                const verifyRes = await fetch(verifyUrl);
                if (verifyRes.ok) {
                  const verifyData = await verifyRes.json() as any;
                  bestMatch.verified = verifyData.data?.result === 'deliverable';
                  bestMatch.verifyStatus = verifyData.data?.result;
                  console.log(`[HUNTER] Verified ${bestMatch.email}: ${verifyData.data?.result}`);
                }
              } catch { /* verification failed, still use the email */ }

              // Update contact info if we found a name
              const updated = { ...prospect, contactEmail: bestMatch.email };
              if (bestMatch.firstName && !prospect.contactName) {
                updated.contactName = `${bestMatch.firstName} ${bestMatch.lastName || ''}`.trim();
              }
              if (bestMatch.position && !prospect.contactTitle) {
                updated.contactTitle = bestMatch.position;
              }
              await saveProspect(updated);

              res.json({ data: {
                email: bestMatch.email,
                contactName: updated.contactName,
                contactTitle: updated.contactTitle,
                confidence: bestMatch.confidence,
                verified: bestMatch.verified,
                verifyStatus: bestMatch.verifyStatus,
                allFound: allEmails.map((e: any) => `${e.email} (${e.firstName || ''} ${e.lastName || ''}, ${e.position || 'unknown role'})`),
                method: 'hunter-domain-search',
              }});
              return;
            }
          }

          // Step C: Email Finder fallback (if domain search returned nothing but we have a name)
          if (firstName) {
            const finderUrl = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${hunterKey}`;
            const finderRes = await fetch(finderUrl);
            if (finderRes.ok) {
              const finderData = await finderRes.json() as any;
              if (finderData.data?.email) {
                await saveProspect({ ...prospect, contactEmail: finderData.data.email });
                res.json({ data: { email: finderData.data.email, confidence: finderData.data.confidence, method: 'hunter-email-finder' } });
                return;
              }
            }
          }
        } catch (err) {
          console.log('[HUNTER] Error:', (err as Error).message);
        }
      }

      // Method 4: Pattern guess from domain
      if (domain && firstName) {
        const guesses = [
          `${firstName}@${domain}`,
          `${firstName}.${lastName}@${domain}`,
          `${firstName[0]}${lastName}@${domain}`,
        ].filter(e => e.includes('@') && lastName);

        if (guesses.length > 0) {
          const bestGuess = guesses[0];
          await saveProspect({ ...prospect, contactEmail: bestGuess });
          res.json({ data: { email: bestGuess, method: 'pattern-guess', alternatives: guesses, note: 'Best guess, not verified' } });
          return;
        }
      }

      res.json({ data: { email: null, method: 'none', note: 'Could not determine email. No domain or contact name available.' } });
    } catch (err: any) {
      console.error('Error finding email:', err);
      res.status(500).json({ error: 'internal', message: err.message });
    }
  });

  // PUT /api/prospects/:id/contact - update contact info
  router.put('/:id/contact', async (req: Request, res: Response) => {
    try {
      const prospect = await getProspect(String(req.params.id));
      if (!prospect) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const { contactName, contactTitle, contactEmail } = req.body;
      const updated = { ...prospect };
      if (contactName !== undefined) updated.contactName = contactName;
      if (contactTitle !== undefined) updated.contactTitle = contactTitle;
      if (contactEmail !== undefined) updated.contactEmail = contactEmail;
      await saveProspect(updated);
      res.json({ data: updated });
    } catch (err) {
      console.error('Error updating contact:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to update contact.' });
    }
  });

  // DELETE /api/prospects/:id - delete prospect
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      await deleteProspect(String(req.params.id));
      res.status(204).send();
    } catch (err) {
      console.error('Error deleting prospect:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to delete prospect.' });
    }
  });

  // POST /api/prospects/bulk-status - bulk update status
  router.post('/bulk-status', async (req: Request, res: Response) => {
    try {
      const { ids, status } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ error: 'validation', message: 'ids must be a non-empty array.' });
        return;
      }
      if (!isValidStatus(status)) {
        res.status(400).json({ error: 'validation', message: 'Invalid or missing status.' });
        return;
      }
      const result = await bulkUpdateStatus(ids, status);
      res.json({ data: result });
    } catch (err) {
      console.error('Error bulk updating status:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to bulk update status.' });
    }
  });

  // POST /api/prospects/:id/regenerate-emails - regenerate outreach emails using current profile
  router.post('/:id/regenerate-emails', async (req: Request, res: Response) => {
    try {
      const prospect = await getProspect(String(req.params.id));
      if (!prospect) {
        res.status(404).json({ error: 'not_found', message: 'Prospect not found.' });
        return;
      }

      const profile = getUserProfile();
      if (!profile.name) {
        res.status(400).json({ error: 'validation', message: 'Set up your profile first (Settings > Profile).' });
        return;
      }

 const { model, route } = getCheapestModel(0.6);

      const voiceInstruction = profile.voiceSample
        ? `\n=== VOICE SAMPLE (match this writing style exactly) ===\n${profile.voiceSample}\n=== END VOICE SAMPLE ===\nIMPORTANT: Write ALL emails in the same voice, tone, and style as the sample above. If the sample is casual and direct, be casual and direct. If it uses humor, use humor. Do NOT default to corporate speak. Match the personality.`
        : '';

      const prompt = `Generate 4 personalized outreach emails for this prospect. Use the sender's real profile information.

=== SENDER PROFILE ===
Name: ${profile.name}
${profile.title ? `Title: ${profile.title}` : ''}
${profile.company ? `Company: ${profile.company}` : ''}
${profile.website ? `Website: ${profile.website}` : ''}
${profile.linkedin ? `LinkedIn: ${profile.linkedin}` : ''}
${profile.email ? `Email: ${profile.email}` : ''}
${profile.valueProp ? `What we do: ${profile.valueProp}` : ''}
${profile.proofPoints?.length ? `Proof points: ${profile.proofPoints.join('; ')}` : ''}
${profile.calendarLink ? `Calendar link for CTA: ${profile.calendarLink}` : ''}
${voiceInstruction}

=== PROSPECT ===
Company: ${prospect.company}
Industry: ${prospect.industry}
Location: ${prospect.location}
Employees: ${prospect.employees}
Revenue: ${prospect.revenue}
Contact: ${prospect.contactName}${prospect.contactTitle ? ', ' + prospect.contactTitle : ''}
${prospect.contactEmail ? `Email: ${prospect.contactEmail}` : ''}
Buying Signals: ${prospect.signals?.join('; ') || 'none identified'}

=== INSTRUCTIONS ===
Write exactly 4 emails as JSON with keys "professional", "conversational", "valueLead", and "direct".
- professional: Polished but not stiff. Lead with credibility and a specific observation about their business.
- conversational: Like you're writing to someone you met at a conference. Warm, human, no corporate language.
- valueLead: Lead with a specific insight or problem you noticed about their business. Make them think "how did they know that?"
- direct: No fluff, no ass-kissing, no "I've been researching your company." Just: who you are, what you do, why it matters to them, and how to reach you. Short. Honest. Like a real person wrote it.

Rules:
- Sign every email from ${profile.name}
- ${profile.website ? `Include ${profile.website} in the signature` : ''}
- ${profile.calendarLink ? `Use this calendar link as the CTA: ${profile.calendarLink}` : 'End with a simple way to respond (reply to this email, call, etc.)'}
- Reference something specific about ${prospect.company}, not generic industry talk
- Keep each email under 120 words. Shorter is better.
- NEVER use: "I'd welcome the opportunity", "I've been researching", "I noticed that", "I hope this finds you well", "touching base", "circle back", "synergy", "leverage", "at your earliest convenience"
- NEVER use placeholder brackets like [Name] or [Company]
- Each email must have a "subject" and "body" field
- Subject lines should be short (under 8 words), specific, and not salesy

Output ONLY valid JSON: {"professional":{"subject":"...","body":"..."},"conversational":{"subject":"...","body":"..."},"valueLead":{"subject":"...","body":"..."},"direct":{"subject":"...","body":"..."}}`;

 const result = await callGenerateText(
   { caller: 'prospect-routes:regenerate-emails', route, model },
   {
     messages: [{ role: 'user', content: prompt }],
     maxTokens: 3000,
     temperature: 0.7,
   },
 );

 const text = result.text || '';
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*"professional"[\s\S]*\}/);

      if (!jsonMatch) {
        res.status(500).json({ error: 'generation', message: 'Failed to parse generated emails.' });
        return;
      }

      const emails = JSON.parse(jsonMatch[0]);
      const fmt = (e: any) => e?.body ? `Subject: ${e.subject}\n\n${e.body}` : (typeof e === 'string' ? e : '');
      const outreach = {
        professional: fmt(emails.professional),
        conversational: fmt(emails.conversational),
        valueLead: fmt(emails.valueLead),
        direct: fmt(emails.direct),
      };

      // Update prospect with new emails
      // We need to save back - use saveProspect which does delete+insert
      await saveProspect({ ...prospect, outreach });

      res.json({ data: { outreach, cost: result.usage } });
    } catch (err: any) {
      console.error('Error regenerating emails:', err);
      res.status(500).json({ error: 'internal', message: err.message || 'Failed to regenerate emails.' });
    }
  });

  // POST /api/prospects/find-all-emails - find emails for all prospects missing them
  router.post('/find-all-emails', async (req: Request, res: Response) => {
    try {
      const prospects = await getAllProspects();
      const needsEmail = prospects.filter(p =>
        !p.contactEmail || p.contactEmail.includes('Not found') || p.contactEmail.includes('Not available') || p.contactEmail.includes('Not provided') || !p.contactEmail.includes('@')
      );

      let found = 0;
      const results: Array<{ company: string; email: string | null; method: string }> = [];

      for (const prospect of needsEmail) {
        try {
          const r = await fetch(`http://localhost:${process.env.PORT || 3001}/api/prospects/${prospect.id}/find-email`, { method: 'POST' });
          const data = await r.json() as any;
          const email = data.data?.email || null;
          results.push({ company: prospect.company, email, method: data.data?.method || 'none' });
          if (email) found++;
        } catch {
          results.push({ company: prospect.company, email: null, method: 'error' });
        }
      }

      res.json({ data: { total: needsEmail.length, found, results } });
    } catch (err: any) {
      res.status(500).json({ error: 'internal', message: err.message });
    }
  });

  // POST /api/prospects/regenerate-all - regenerate emails for all prospects
  router.post('/regenerate-all', async (req: Request, res: Response) => {
    try {
      const profile = getUserProfile();
      if (!profile.name) {
        res.status(400).json({ error: 'validation', message: 'Set up your profile first.' });
        return;
      }

      const prospects = await getAllProspects();
      let regenerated = 0;
      const errors: string[] = [];

      for (const prospect of prospects) {
        try {
          // Call the single regenerate internally
          const singleRes = await fetch(`http://localhost:${process.env.PORT || 3001}/api/prospects/${prospect.id}/regenerate-emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          if (singleRes.ok) regenerated++;
          else errors.push(`${prospect.company}: ${(await singleRes.json()).message}`);
        } catch (err: any) {
          errors.push(`${prospect.company}: ${err.message}`);
        }
      }

      res.json({ data: { total: prospects.length, regenerated, errors } });
    } catch (err: any) {
      res.status(500).json({ error: 'internal', message: err.message });
    }
  });

  // POST /api/prospects/save-from-run - save prospects from a deploy run's Command output
  router.post('/save-from-run', async (req: Request, res: Response) => {
    try {
      const { runId, commandOutput } = req.body;
      if (!runId || !commandOutput) {
        res.status(400).json({ error: 'validation', message: 'runId and commandOutput are required.' });
        return;
      }
      const result = await saveProspectsFromRun(runId, commandOutput);
      res.json({ data: result });
    } catch (err) {
      console.error('Error saving prospects from run:', err);
      res.status(500).json({ error: 'internal', message: 'Failed to save prospects from run.' });
    }
  });

  return router;
}
