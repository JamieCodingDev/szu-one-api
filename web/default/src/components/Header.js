import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserContext } from '../context/User';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Container,
  Dropdown,
  Icon,
  Menu,
  Segment,
} from 'semantic-ui-react';
import { API, getLogo, getSystemName, isAdmin, isMobile, showSuccess } from '../helpers';
import '../index.css';

// Header Buttons
const headerButtons = [
  {
    name: 'header.usage',
    to: '/dashboard',
    icon: 'chart bar',
  },
  {
    name: 'header.api_keys',
    to: '/token',
    icon: 'key',
  },
  {
    name: 'header.redemption',
    to: '/redemption',
    icon: 'gift',
  },
  {
    name: 'header.billing',
    to: '/billing',
    icon: 'file alternate outline',
  },
  {
    name: 'header.user',
    to: '/user',
    icon: 'users',
    adminOnly: true,
  },
  {
    name: 'header.about',
    to: '/about',
    icon: 'info circle',
  },
];

const Header = () => {
  const { t, i18n } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  let navigate = useNavigate();
  const location = useLocation();

  const [showSidebar, setShowSidebar] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('ui_theme_v2') || 'light'
  );
  const systemName = getSystemName();
  const logo = getLogo();

  async function logout() {
    setShowSidebar(false);
    await API.get('/api/user/logout');
    showSuccess('注销成功!');
    userDispatch({ type: 'logout' });
    localStorage.removeItem('user');
    navigate('/login');
  }

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ui_theme_v2', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark'
    );
  };

  const renderButtons = (isMobile) => {
    return headerButtons.map((button) => {
      if (button.adminOnly && !isAdmin()) return null;
      if (isMobile) {
        return (
          <Menu.Item
            key={button.name}
            active={
              location.pathname === button.to ||
              location.pathname.startsWith(`${button.to}/`)
            }
            className='app-nav-item'
            onClick={() => {
              navigate(button.to);
              setShowSidebar(false);
            }}
            style={{ fontSize: '15px' }}
          >
            {t(button.name)}
          </Menu.Item>
        );
      }
      return (
        <Menu.Item
          key={button.name}
          as={Link}
          to={button.to}
          active={
            location.pathname === button.to ||
            location.pathname.startsWith(`${button.to}/`)
          }
          className='app-nav-item'
          style={{
            fontSize: '15px',
            fontWeight: '400',
          }}
        >
          <Icon name={button.icon} style={{ marginRight: '4px' }} />
          {t(button.name)}
        </Menu.Item>
      );
    });
  };

  // Add language switcher dropdown
  const languageOptions = [
    { key: 'zh', text: '中文', value: 'zh' },
    { key: 'en', text: 'English', value: 'en' },
  ];

  const changeLanguage = (language) => {
    i18n.changeLanguage(language);
  };

  if (isMobile()) {
    return (
      <>
        <Menu
          borderless
          size='large'
          className='app-header'
          style={
            showSidebar
              ? {
                  borderBottom: 'none',
                  marginBottom: '0',
                  borderTop: 'none',
                  height: '51px',
                }
              : { borderTop: 'none', height: '52px' }
          }
        >
          <Container
            style={{
              width: '100%',
              maxWidth: isMobile() ? '100%' : '1200px',
              padding: isMobile() ? '0 10px' : '0 20px',
            }}
          >
            <Menu.Item as={Link} to='/dashboard' className='app-brand'>
              <img className='app-brand-logo' src={logo} alt='logo' style={{ marginRight: '0.75em' }} />
              <div style={{ fontSize: '20px' }}>
                <b>{systemName}</b>
              </div>
            </Menu.Item>
            <Menu.Menu position='right'>
              <Menu.Item onClick={toggleSidebar}>
                <Icon name={showSidebar ? 'close' : 'sidebar'} />
              </Menu.Item>
            </Menu.Menu>
          </Container>
        </Menu>
        {showSidebar ? (
          <Segment className='app-mobile-menu' style={{ marginTop: 0, borderTop: '0' }}>
            <Menu secondary vertical style={{ width: '100%', margin: 0 }}>
              {renderButtons(true)}
              <Menu.Item onClick={toggleTheme} className='app-theme-toggle'>
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                {t(
                  theme === 'dark'
                    ? 'header.switch_to_light'
                    : 'header.switch_to_dark'
                )}
              </Menu.Item>
              <Menu.Item>
                <Dropdown
                  selection
                  trigger={
                    <Icon
                      name='language'
                      style={{ margin: 0, fontSize: '18px' }}
                    />
                  }
                  options={languageOptions}
                  value={i18n.language}
                  onChange={(_, { value }) => changeLanguage(value)}
                />
              </Menu.Item>
              <Menu.Item>
                {userState.user ? (
                  <Button onClick={logout} style={{ color: '#666666' }}>
                    {t('header.logout')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setShowSidebar(false);
                        navigate('/login');
                      }}
                    >
                      {t('header.login')}
                    </Button>
                    <Button
                      onClick={() => {
                        setShowSidebar(false);
                        navigate('/register');
                      }}
                    >
                      {t('header.register')}
                    </Button>
                  </>
                )}
              </Menu.Item>
            </Menu>
          </Segment>
        ) : (
          <></>
        )}
      </>
    );
  }

  return (
    <>
      <Menu
        borderless
        className='app-header'
        style={{
          borderTop: 'none',
          boxShadow: 'rgba(0, 0, 0, 0.04) 0px 2px 12px 0px',
          border: 'none',
        }}
      >
        <Container
          style={{
            width: '100%',
            maxWidth: isMobile() ? '100%' : '1200px',
            padding: isMobile() ? '0 10px' : '0 20px',
          }}
        >
          <Menu.Item as={Link} to='/dashboard' className='hide-on-mobile app-brand'>
            <img className='app-brand-logo' src={logo} alt='logo' style={{ marginRight: '0.75em' }} />
            <div
              style={{
                fontSize: '18px',
                fontWeight: '500',
              }}
            >
              {systemName}
            </div>
          </Menu.Item>
          {renderButtons(false)}
          <Menu.Menu position='right'>
            <Menu.Item
              onClick={toggleTheme}
              className='app-theme-toggle'
              title={t(
                theme === 'dark'
                  ? 'header.switch_to_light'
                  : 'header.switch_to_dark'
              )}
            >
              <Icon
                name={theme === 'dark' ? 'sun' : 'moon'}
                style={{ margin: 0, fontSize: '18px' }}
              />
            </Menu.Item>
            <Dropdown
              item
              trigger={
                <Icon name='language' style={{ margin: 0, fontSize: '18px' }} />
              }
              options={languageOptions}
              value={i18n.language}
              onChange={(_, { value }) => changeLanguage(value)}
              style={{
                fontSize: '16px',
                fontWeight: '400',
                color: '#666',
                padding: '0 10px',
              }}
            />
            {userState.user ? (
              <Dropdown
                text={userState.user.username}
                pointing
                className='link item'
                style={{
                  fontSize: '15px',
                  fontWeight: '400',
                  color: '#666',
                }}
              >
                <Dropdown.Menu>
                  <Dropdown.Item
                    onClick={logout}
                    style={{
                      fontSize: '15px',
                      fontWeight: '400',
                      color: '#666',
                    }}
                  >
                    {t('header.logout')}
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            ) : (
              <Menu.Item
                name={t('header.login')}
                as={Link}
                to='/login'
                className='btn btn-link'
                style={{
                  fontSize: '15px',
                  fontWeight: '400',
                  color: '#666',
                }}
              />
            )}
          </Menu.Menu>
        </Container>
      </Menu>
    </>
  );
};

export default Header;
