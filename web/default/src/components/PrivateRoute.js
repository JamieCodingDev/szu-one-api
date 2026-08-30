import { Navigate } from 'react-router-dom';

import { history, isAdmin } from '../helpers';

function PrivateRoute({ children }) {
  if (!localStorage.getItem('user')) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  return children;
}

function AdminRoute({ children }) {
  if (!localStorage.getItem('user')) {
    return <Navigate to='/login' state={{ from: history.location }} />;
  }
  if (!isAdmin()) {
    return <Navigate to='/dashboard' replace />;
  }
  return children;
}

export { AdminRoute, PrivateRoute };
