/**
 * useCoins — Shared wallet hook for all games.
 *
 * Reads the player's coin balance from the backend wallet API.
 * Provides `spend(amount, gameType?)` and `earn(amount, gameType?)` helpers
 * that optimistically update the local balance and then sync with the server.
 */
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export function useCoins() {
  const queryClient = useQueryClient();
  const [balance, setBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await axios.get('/wallet/balance');
      setBalance(Number(res.data.balance) ?? 0);
    } catch {
      // user might not be logged in yet — silently ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    const iv = setInterval(fetchBalance, 15_000);
    return () => clearInterval(iv);
  }, [fetchBalance]);

  /**
   * Optimistically deduct `amount` coins; syncs to backend.
   * Returns true if allowed (balance >= amount), false otherwise.
   *
   * @param {number} amount
   * @param {string} [gameType='GAME']  Label for the transaction log
   */
  const spend = useCallback(
    async (amount, gameType = 'GAME') => {
      if (balance < amount) return false;
      // Optimistic update
      setBalance(b => b - Number(amount));
      try {
        await axios.post('/wallet/spend', { amount: Number(amount), gameType });
        // Invalidate react-query cache so Layout coin counter refreshes
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      } catch {
        // Server rejected — roll back
        fetchBalance();
      }
      return true;
    },
    [balance, fetchBalance, queryClient]
  );

  /**
   * Optimistically credit `amount` coins; syncs to backend.
   *
   * @param {number} amount
   * @param {string} [gameType='GAME']  Label for the transaction log
   */
  const earn = useCallback(
    async (amount, gameType = 'GAME') => {
      if (amount <= 0) return;
      setBalance(b => b + Number(amount));
      try {
        await axios.post('/wallet/earn', { amount: Number(amount), gameType });
        queryClient.invalidateQueries({ queryKey: ['balance'] });
      } catch {
        fetchBalance();
      }
    },
    [fetchBalance, queryClient]
  );

  /** Force-refresh balance from server */
  const refresh = useCallback(() => fetchBalance(), [fetchBalance]);

  return { balance, setBalance, spend, earn, refresh, isLoading };
}
