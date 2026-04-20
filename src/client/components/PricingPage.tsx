import React, { useState } from 'react';

interface PricingPageProps {
  onSelectPlan: (plan: 'free' | 'starter' | 'pro' | 'enterprise') => void;
  onClose: () => void;
}

interface PlanFeature {
  text: string;
  bold?: boolean;
}

interface Plan {
  id: 'free' | 'starter' | 'pro' | 'enterprise';
  name: string;
  badge?: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  description: string;
  features: PlanFeature[];
  buttonLabel: string;
  buttonStyle: 'outline' | 'cyan' | 'green' | 'outline';
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    description: 'Get started',
    features: [
      { text: 'Visual canvas designer' },
      { text: '1 swarm, up to 8 agents' },
      { text: 'Mock test only' },
      { text: 'Export JSON' },
      { text: 'Copilot chat' },
      { text: '2 community templates' },
    ],
    buttonLabel: 'Start Free',
    buttonStyle: 'outline',
  },
  {
    id: 'starter',
    name: 'Starter',
    badge: 'Most popular for individuals',
    monthlyPrice: 29,
    annualPrice: 278,
    description: 'Everything in Free, plus:',
    features: [
      { text: '3 swarms, up to 15 agents each' },
      { text: 'Live test (bring your own API keys)' },
      { text: 'All 8 templates' },
      { text: 'Handoff doc export' },
      { text: 'Deploy (run once)' },
    ],
    buttonLabel: 'Start Starter',
    buttonStyle: 'cyan',
  },
  {
    id: 'pro',
    name: 'Pro',
    badge: 'Best for teams & lead gen',
    monthlyPrice: 79,
    annualPrice: 758,
    description: 'Everything in Starter, plus:',
    features: [
      { text: 'Unlimited swarms and agents' },
      { text: 'Prompt to Interview to Swarm' },
      { text: 'Deploy with scheduling' },
      { text: 'Prospect dashboard + email outreach' },
      { text: 'Auto-enrichment (scraping + Hunter.io)' },
      { text: 'Decision traces / observability' },
      { text: 'CSV export' },
      { text: 'Priority copilot' },
    ],
    buttonLabel: 'Start Pro',
    buttonStyle: 'green',
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    annualPrice: null,
    description: 'Everything in Pro, plus:',
    features: [
      { text: 'White-label / custom branding' },
      { text: 'SSO / SAML' },
      { text: 'Self-hosted option (Docker)' },
      { text: 'Dedicated support' },
      { text: 'Custom template creation' },
      { text: 'SLA' },
    ],
    buttonLabel: 'Contact Sales',
    buttonStyle: 'outline',
  },
];

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: 'Can I bring my own API keys?',
    answer: 'Yes, all plans support your own API keys. You pay your provider directly for usage.',
  },
  {
    question: 'What happens when I hit my swarm limit?',
    answer: 'You can upgrade to a higher plan or delete an existing swarm to make room for a new one.',
  },
  {
    question: 'Is my data stored on your servers?',
    answer: 'For the cloud version, yes. All data is encrypted at rest and in transit. A self-hosted option is available on the Enterprise plan.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Yes. No contracts, no commitment. Cancel anytime from your account settings.',
  },
  {
    question: 'Do you offer refunds?',
    answer: '14-day money-back guarantee on all paid plans. No questions asked.',
  },
];

export function PricingPage({ onSelectPlan, onClose }: PricingPageProps) {
  const [annual, setAnnual] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const getButtonStyles = (style: string, highlighted?: boolean): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%',
      padding: '12px 0',
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'var(--font-primary)',
      cursor: 'pointer',
      transition: 'opacity 0.2s, transform 0.1s',
      border: 'none',
    };

    switch (style) {
      case 'cyan':
        return { ...base, background: 'var(--accent-primary)', color: '#0f172a' };
      case 'green':
        return { ...base, background: '#22c55e', color: '#0f172a', boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)' };
      case 'outline':
      default:
        return { ...base, background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)' };
    }
  };

  const cardStyle = (highlighted?: boolean): React.CSSProperties => ({
    background: 'var(--bg-surface)',
    border: highlighted ? '1px solid #22c55e' : '1px solid var(--border-default)',
    borderRadius: 16,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 260,
    maxWidth: 320,
    position: 'relative',
    transition: 'transform 0.2s, box-shadow 0.2s',
    boxShadow: highlighted
      ? '0 0 40px rgba(34, 197, 94, 0.15), 0 20px 60px rgba(0, 0, 0, 0.3)'
      : '0 10px 40px rgba(0, 0, 0, 0.2)',
  });

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: 'var(--font-primary)',
      zIndex: 9999,
      overflowY: 'auto',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 20,
          right: 24,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          color: 'var(--text-primary)',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: 18,
          zIndex: 10,
        }}
      >
        &times;
      </button>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
        <h1 style={{
          color: 'var(--text-primary)',
          fontSize: 36,
          fontWeight: 700,
          margin: '0 0 10px',
          letterSpacing: '-0.02em',
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: 16,
          margin: 0,
        }}>
          Start free, upgrade when you're ready
        </p>

        {/* Toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          marginTop: 28,
        }}>
          <span style={{
            fontSize: 14,
            color: !annual ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: !annual ? 600 : 400,
          }}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            style={{
              width: 48,
              height: 26,
              borderRadius: 13,
              background: annual ? 'var(--accent-primary)' : 'var(--border-default)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
            }}
          >
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              background: '#fff',
              position: 'absolute',
              top: 3,
              left: annual ? 25 : 3,
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{
            fontSize: 14,
            color: annual ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: annual ? 600 : 400,
          }}>
            Annual
          </span>
          {annual && (
            <span style={{
              fontSize: 12,
              color: '#22c55e',
              fontWeight: 600,
              background: 'rgba(34, 197, 94, 0.1)',
              padding: '3px 8px',
              borderRadius: 4,
            }}>
              Save 20%
            </span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div style={{
        display: 'flex',
        gap: 20,
        padding: '0 40px 60px',
        maxWidth: 1400,
        width: '100%',
        justifyContent: 'center',
        flexWrap: 'wrap',
      }}>
        {plans.map((plan) => (
          <div key={plan.id} style={cardStyle(plan.highlighted)}>
            {plan.badge && (
              <div style={{
                position: 'absolute',
                top: -12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: plan.highlighted ? '#22c55e' : 'var(--accent-primary)',
                color: '#0f172a',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 12px',
                borderRadius: 20,
                whiteSpace: 'nowrap',
              }}>
                {plan.badge}
              </div>
            )}

            <h3 style={{
              color: 'var(--text-primary)',
              fontSize: 20,
              fontWeight: 700,
              margin: '0 0 4px',
            }}>
              {plan.name}
            </h3>

            <div style={{ marginBottom: 12 }}>
              {plan.monthlyPrice !== null ? (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${annual ? Math.round((plan.annualPrice || 0) / 12) : plan.monthlyPrice}
                  </span>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    /mo
                  </span>
                </div>
              ) : (
                <div style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}>
                  Custom
                </div>
              )}
              {annual && plan.annualPrice !== null && plan.annualPrice > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  ${plan.annualPrice}/year
                </div>
              )}
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 13,
              margin: '0 0 16px',
              fontWeight: 500,
            }}>
              {plan.description}
            </p>

            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 24px',
              flex: 1,
            }}>
              {plan.features.map((feature, idx) => (
                <li key={idx} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 10,
                  fontSize: 13,
                  color: 'var(--text-primary)',
                  lineHeight: 1.4,
                }}>
                  <span style={{
                    color: plan.highlighted ? '#22c55e' : 'var(--accent-primary)',
                    fontSize: 14,
                    lineHeight: 1.3,
                    flexShrink: 0,
                  }}>
                    &#10003;
                  </span>
                  {feature.text}
                </li>
              ))}
            </ul>

            <button
              style={getButtonStyles(plan.buttonStyle, plan.highlighted)}
              onClick={() => onSelectPlan(plan.id)}
            >
              {plan.buttonLabel}
            </button>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={{
        width: '100%',
        maxWidth: 720,
        padding: '0 20px 80px',
      }}>
        <h2 style={{
          color: 'var(--text-primary)',
          fontSize: 24,
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: 28,
        }}>
          Frequently Asked Questions
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {faqItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                {item.question}
                <span style={{
                  color: 'var(--text-secondary)',
                  fontSize: 18,
                  transition: 'transform 0.2s',
                  transform: expandedFaq === idx ? 'rotate(45deg)' : 'none',
                }}>
                  +
                </span>
              </button>
              {expandedFaq === idx && (
                <div style={{
                  padding: '0 20px 16px',
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  lineHeight: 1.6,
                }}>
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
