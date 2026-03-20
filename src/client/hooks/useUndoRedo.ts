import { useState, useCallback } from 'react';

interface Command {
  description: string;
  execute: () => Promise<void>;
  undo: () => Promise<void>;
}

interface UndoRedoState {
  past: Command[];
  future: Command[];
  canUndo: boolean;
  canRedo: boolean;
  lastAction: string | null;
}

export function useUndoRedo() {
  const [state, setState] = useState<UndoRedoState>({
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
    lastAction: null,
  });

  const execute = useCallback(async (command: Command) => {
    await command.execute();
    setState(prev => ({
      past: [...prev.past, command],
      future: [],
      canUndo: true,
      canRedo: false,
      lastAction: command.description,
    }));
  }, []);

  const undo = useCallback(async () => {
    setState(prev => {
      if (prev.past.length === 0) return prev;
      const command = prev.past[prev.past.length - 1];
      command.undo();
      const newPast = prev.past.slice(0, -1);
      return {
        past: newPast,
        future: [command, ...prev.future],
        canUndo: newPast.length > 0,
        canRedo: true,
        lastAction: `Undo: ${command.description}`,
      };
    });
  }, []);

  const redo = useCallback(async () => {
    setState(prev => {
      if (prev.future.length === 0) return prev;
      const command = prev.future[0];
      command.execute();
      const newFuture = prev.future.slice(1);
      return {
        past: [...prev.past, command],
        future: newFuture,
        canUndo: true,
        canRedo: newFuture.length > 0,
        lastAction: `Redo: ${command.description}`,
      };
    });
  }, []);

  return { ...state, execute, undo, redo };
}
