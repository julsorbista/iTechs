import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { normalizeGameType } from '../utils/gameTracks';
import LoadingSpinner from '../components/LoadingSpinner';
import { stopStudentMenuLoop } from '../utils/studentMenuAudio';

const StudentGameOverlay = lazy(() => import('../components/student/StudentGameOverlay'));

const StudentGamePlayPage = () => {
  const navigate = useNavigate();
  const { gameType: routeGameType, levelNumber } = useParams();
  const gameType = normalizeGameType(routeGameType);

  useEffect(() => {
    stopStudentMenuLoop({ rewind: false });
  }, []);

  if (!gameType) {
    return <Navigate to="/student" replace />;
  }

  if (routeGameType !== gameType) {
    return <Navigate to={`/student/games/${gameType}/levels/${levelNumber}/play`} replace />;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <StudentGameOverlay
        gameType={gameType}
        levelNumber={levelNumber}
        onClose={() => navigate(`/student/games/${gameType}`)}
      />
    </Suspense>
  );
};

export default StudentGamePlayPage;
