import React, { Suspense, useContext, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Loading from './components/Loading';
import { AdminRoute, PrivateRoute } from './components/PrivateRoute';
import RegisterForm from './components/RegisterForm';
import LoginForm from './components/LoginForm';
import { API, getLogo, getSystemName, showError, showNotice } from './helpers';
import PasswordResetForm from './components/PasswordResetForm';
import GitHubOAuth from './components/GitHubOAuth';
import PasswordResetConfirm from './components/PasswordResetConfirm';
import { UserContext } from './context/User';
import { StatusContext } from './context/Status';
import Token from './pages/Token';
import EditToken from './pages/Token/EditToken';
import Redemption from './pages/Redemption';
import EditRedemption from './pages/Redemption/EditRedemption';
import LarkOAuth from './components/LarkOAuth';
import Dashboard from './pages/Dashboard';
import Billing from './pages/Billing';
import About from './pages/About';
import User from './pages/User';
import EditUser from './pages/User/EditUser';
import AddUser from './pages/User/AddUser';

function App() {
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState, statusDispatch] = useContext(StatusContext);

  const loadUser = () => {
    let user = localStorage.getItem('user');
    if (user) {
      let data = JSON.parse(user);
      userDispatch({ type: 'login', payload: data });
    }
  };
  const loadStatus = async () => {
    try {
      const res = await API.get('/api/status');
      const { success, message, data } = res.data || {}; // Add default empty object
      if (success && data) {
        // Check data exists
        localStorage.setItem('status', JSON.stringify(data));
        statusDispatch({ type: 'set', payload: data });
        localStorage.setItem('system_name', data.system_name);
        localStorage.setItem('logo', data.logo);
        localStorage.setItem('footer_html', data.footer_html);
        if (data.chat_link) {
          localStorage.setItem('chat_link', data.chat_link);
        } else {
          localStorage.removeItem('chat_link');
        }
        if (
          data.version !== process.env.REACT_APP_VERSION &&
          data.version !== 'v0.0.0' &&
          process.env.REACT_APP_VERSION !== ''
        ) {
          showNotice(
            `新版本可用：${data.version}，请使用快捷键 Shift + F5 刷新页面`
          );
        }
      } else {
        showError(message || '无法正常连接至服务器！');
      }
    } catch (error) {
      showError(error.message || '无法正常连接至服务器！');
    }
  };

  useEffect(() => {
    loadUser();
    loadStatus().then();
    let systemName = getSystemName();
    if (systemName) {
      document.title = systemName;
    }
    let logo = getLogo();
    if (logo) {
      let linkElement = document.querySelector("link[rel~='icon']");
      if (linkElement) {
        linkElement.href = logo;
      }
    }
  }, []);

  return (
    <Routes>
      <Route
        path='/'
        element={<Navigate to='/dashboard' replace />}
      />
      <Route
        path='/token'
        element={
          <PrivateRoute>
            <Token />
          </PrivateRoute>
        }
      />
      <Route
        path='/token/edit/:id'
        element={
          <PrivateRoute>
            <Suspense fallback={<Loading></Loading>}>
              <EditToken />
            </Suspense>
          </PrivateRoute>
        }
      />
      <Route
        path='/token/add'
        element={
          <PrivateRoute>
            <Suspense fallback={<Loading></Loading>}>
              <EditToken />
            </Suspense>
          </PrivateRoute>
        }
      />
      <Route
        path='/redemption'
        element={
          <PrivateRoute>
            <Redemption />
          </PrivateRoute>
        }
      />
      <Route
        path='/redemption/edit/:id'
        element={
          <AdminRoute>
            <Suspense fallback={<Loading></Loading>}>
              <EditRedemption />
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path='/redemption/add'
        element={
          <AdminRoute>
            <Suspense fallback={<Loading></Loading>}>
              <EditRedemption />
            </Suspense>
          </AdminRoute>
        }
      />
      <Route
        path='/user'
        element={
          <AdminRoute>
            <User />
          </AdminRoute>
        }
      />
      <Route
        path='/user/edit/:id'
        element={
          <AdminRoute>
            <EditUser />
          </AdminRoute>
        }
      />
      <Route
        path='/user/edit'
        element={<Navigate to='/dashboard' replace />}
      />
      <Route
        path='/user/add'
        element={
          <AdminRoute>
            <AddUser />
          </AdminRoute>
        }
      />
      <Route
        path='/user/reset'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <PasswordResetConfirm />
          </Suspense>
        }
      />
      <Route
        path='/login'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <LoginForm />
          </Suspense>
        }
      />
      <Route
        path='/register'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <RegisterForm />
          </Suspense>
        }
      />
      <Route
        path='/reset'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <PasswordResetForm />
          </Suspense>
        }
      />
      <Route
        path='/oauth/github'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <GitHubOAuth />
          </Suspense>
        }
      />
      <Route
        path='/oauth/lark'
        element={
          <Suspense fallback={<Loading></Loading>}>
            <LarkOAuth />
          </Suspense>
        }
      />
      <Route
        path='/setting'
        element={<Navigate to='/dashboard' replace />}
      />
      <Route
        path='/topup'
        element={
          <PrivateRoute>
            <Navigate to='/redemption' replace />
          </PrivateRoute>
        }
      />
      <Route
        path='/log'
        element={<Navigate to='/billing' replace />}
      />
      <Route
        path='/about'
        element={
          <PrivateRoute>
            <About />
          </PrivateRoute>
        }
      />
      <Route
        path='/chat'
        element={<Navigate to='/dashboard' replace />}
      />
      <Route
        path='/dashboard'
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path='/billing'
        element={
          <PrivateRoute>
            <Billing />
          </PrivateRoute>
        }
      />
      <Route path='*' element={<Navigate to='/dashboard' replace />} />
    </Routes>
  );
}

export default App;
