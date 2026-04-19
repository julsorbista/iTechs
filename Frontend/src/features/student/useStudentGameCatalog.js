import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { handleAPIError, levelAPI } from '../../utils/api';
import { sortByGameType } from '../../utils/gameTracks';

export const useStudentGameCatalog = (initialGameType = 'GAME_ONE') => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [focusedGameType, setFocusedGameType] = useState(initialGameType);

  useEffect(() => {
    let cancelled = false;

    const loadGames = async () => {
      try {
        setLoading(true);
        const response = await levelAPI.getMyGames();

        if (cancelled || response.status !== 'success') {
          return;
        }

        const gameList = response.data.games || [];
        setGames(gameList);
        setFocusedGameType((currentGameType) => (
          gameList.some((game) => game.gameType === currentGameType)
            ? currentGameType
            : gameList[0]?.gameType || currentGameType
        ));
      } catch (error) {
        if (!cancelled) {
          toast.error(handleAPIError(error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGames();

    return () => {
      cancelled = true;
    };
  }, []);

  const orderedGames = useMemo(
    () => [...games].sort((left, right) => sortByGameType(left.gameType, right.gameType)),
    [games],
  );

  const selectedGame = useMemo(
    () => orderedGames.find((game) => game.gameType === focusedGameType) || orderedGames[0] || null,
    [focusedGameType, orderedGames],
  );

  return {
    games,
    orderedGames,
    selectedGame,
    loading,
    focusedGameType,
    setFocusedGameType,
  };
};
