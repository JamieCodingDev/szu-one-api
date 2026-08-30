import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dropdown,
  Form,
  Icon,
  Label,
  Pagination,
  Popup,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { API, showError, showSuccess } from '../helpers';
import { useTranslation } from 'react-i18next';

import { ITEMS_PER_PAGE } from '../constants';
import { renderNumber, renderQuota } from '../helpers/render';

function renderRole(role, t) {
  switch (role) {
    case 1:
      return <Label>{t('user.table.role_types.student')}</Label>;
    case 5:
      return <Label color='blue'>{t('user.table.role_types.teacher')}</Label>;
    case 10:
      return <Label color='yellow'>{t('user.table.role_types.admin')}</Label>;
    case 100:
      return (
        <Label color='orange'>{t('user.table.role_types.system_admin')}</Label>
      );
    default:
      return <Label color='red'>{t('user.table.role_types.unknown')}</Label>;
  }
}

function renderCompactQuota(quota, t) {
  const numericQuota = Number(quota) || 0;
  if (Math.abs(numericQuota) < 1000000000) {
    return renderQuota(numericQuota, t);
  }
  const amount = new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(numericQuota);
  return t('common.quota.points', { amount });
}

const UsersTable = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [orderBy, setOrderBy] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const currentRole = JSON.parse(localStorage.getItem('user') || '{}').role || 0;

  const visibleUsers = useMemo(
    () => users.filter((user) => !user.deleted),
    [users]
  );
  const loadedPageCount = Math.max(
    1,
    Math.ceil(visibleUsers.length / ITEMS_PER_PAGE)
  );
  const totalPages = loadedPageCount + (hasMore ? 1 : 0);
  const pageUsers = visibleUsers.slice(
    (activePage - 1) * ITEMS_PER_PAGE,
    activePage * ITEMS_PER_PAGE
  );

  const loadUsers = async (pageIndex = 0) => {
    setLoading(true);
    try {
      const res = await API.get(`/api/user/?p=${pageIndex}&order=${orderBy}`);
      if (!res?.data) {
        throw new Error(t('user.messages.load_failed'));
      }
      const { success, message, data = [] } = res.data;
      if (!success) {
        showError(message);
        return false;
      }
      if (pageIndex === 0) {
        setUsers(data);
      } else {
        setUsers((currentUsers) => {
          const knownIds = new Set(currentUsers.map((user) => user.id));
          return [
            ...currentUsers,
            ...data.filter((user) => !knownIds.has(user.id)),
          ];
        });
      }
      setHasMore(data.length === ITEMS_PER_PAGE);
      return data.length > 0;
    } catch (error) {
      showError(error?.message || t('user.messages.load_failed'));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onPaginationChange = async (event, { activePage: nextPage }) => {
    if (nextPage > loadedPageCount) {
      const appended = await loadUsers(nextPage - 1);
      if (!appended) return;
    }
    setActivePage(nextPage);
  };

  useEffect(() => {
    setActivePage(1);
    loadUsers(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy]);

  const manageUser = async (username, action, userId) => {
    try {
      const res = await API.post('/api/user/manage', { username, action });
      if (!res?.data) return;
      const { success, message, data } = res.data;
      if (!success) {
        showError(message);
        return;
      }
      showSuccess(t('user.messages.operation_success'));
      setUsers((currentUsers) =>
        currentUsers.map((user) => {
          if (user.id !== userId) return user;
          if (action === 'delete') return { ...user, deleted: true };
          return { ...user, status: data.status, role: data.role };
        })
      );
    } catch (error) {
      showError(error?.message || t('user.messages.operation_failed'));
    }
  };

  const renderStatus = (status) => {
    const active = status === 1;
    return (
      <span className={`user-status ${active ? 'is-active' : 'is-disabled'}`}>
        <span className='user-status-dot' />
        {active
          ? t('user.table.status_types.activated')
          : t('user.table.status_types.banned')}
      </span>
    );
  };

  const searchUsers = async () => {
    const normalizedKeyword = searchKeyword.trim();
    if (normalizedKeyword === '') {
      setOrderBy('');
      setActivePage(1);
      await loadUsers(0);
      return;
    }
    setSearching(true);
    try {
      const res = await API.get(
        `/api/user/search?keyword=${encodeURIComponent(normalizedKeyword)}`
      );
      if (!res?.data) return;
      const { success, message, data = [] } = res.data;
      if (success) {
        setUsers(data);
        setHasMore(false);
        setActivePage(1);
      } else {
        showError(message);
      }
    } catch (error) {
      showError(error?.message || t('user.messages.load_failed'));
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div className='user-management-toolbar'>
        <Form className='user-search-form' onSubmit={searchUsers}>
          <Form.Input
            icon='search'
            fluid
            iconPosition='left'
            placeholder={t('user.search')}
            value={searchKeyword}
            loading={searching}
            onChange={(event, { value }) => setSearchKeyword(value)}
          />
        </Form>
        <div className='user-management-toolbar-actions'>
          <Dropdown
            className='user-sort-dropdown'
            placeholder={t('user.table.sort_by')}
            selection
            options={[
              { key: '', text: t('user.table.sort.default'), value: '' },
              {
                key: 'quota',
                text: t('user.table.sort.by_quota'),
                value: 'quota',
              },
              {
                key: 'used_quota',
                text: t('user.table.sort.by_used_quota'),
                value: 'used_quota',
              },
              {
                key: 'request_count',
                text: t('user.table.sort.by_request_count'),
                value: 'request_count',
              },
            ]}
            value={orderBy}
            onChange={(event, { value }) => setOrderBy(value)}
          />
          <Button primary as={Link} to='/user/add' loading={loading}>
            <Icon name='plus' />
            {t('user.buttons.add')}
          </Button>
        </div>
      </div>

      <div className='user-list-shell'>
        <div className='user-list-grid user-list-header'>
          <div>{t('user.table.account')}</div>
          <div>{t('user.table.identity')}</div>
          <div>{t('user.table.remaining_quota')}</div>
          <div>{t('user.table.used_quota')}</div>
          <div>{t('user.table.request_count')}</div>
          <div>{t('user.table.status_text')}</div>
          <div>{t('user.table.actions')}</div>
        </div>

        <div className='user-list-body'>
          {pageUsers.length === 0 && !loading ? (
            <div className='user-list-empty'>{t('user.table.empty')}</div>
          ) : (
            pageUsers.map((user) => {
              const canManage = user.role < currentRole;
              const canEdit =
                canManage || (currentRole === 100 && user.role === 100);
              const fullRemainingQuota = renderQuota(user.quota, t);
              const fullUsedQuota = renderQuota(user.used_quota, t);
              const avatarText = (user.display_name || user.username || '?')
                .trim()
                .charAt(0)
                .toUpperCase();

              return (
                <div className='user-list-grid user-list-row' key={user.id}>
                  <div className='user-profile-cell'>
                    <div className='user-avatar'>{avatarText}</div>
                    <div className='user-profile-text'>
                      <strong>{user.display_name || user.username}</strong>
                      <span>@{user.username}</span>
                    </div>
                  </div>
                  <div className='user-identity-cell'>
                    {renderRole(user.role, t)}
                  </div>
                  <div className='user-metric-cell' title={fullRemainingQuota}>
                    <strong>{renderCompactQuota(user.quota, t)}</strong>
                  </div>
                  <div className='user-metric-cell' title={fullUsedQuota}>
                    <strong>{renderCompactQuota(user.used_quota, t)}</strong>
                  </div>
                  <div className='user-request-count'>
                    {renderNumber(user.request_count)}
                  </div>
                  <div>{renderStatus(user.status)}</div>
                  <div className='user-action-cell'>
                    {canEdit && (
                      <Button
                        size='mini'
                        primary
                        basic
                        as={Link}
                        to={`/user/edit/${user.id}`}
                      >
                        {t('user.buttons.edit')}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size='mini'
                        onClick={() =>
                          manageUser(
                            user.username,
                            user.status === 1 ? 'disable' : 'enable',
                            user.id
                          )
                        }
                      >
                        {user.status === 1
                          ? t('user.buttons.disable')
                          : t('user.buttons.enable')}
                      </Button>
                    )}
                    {canManage && (
                      <Popup
                        trigger={
                          <Button size='mini' negative basic>
                            {t('user.buttons.delete')}
                          </Button>
                        }
                        on='click'
                        flowing
                        hoverable
                      >
                        <Button
                          negative
                          size='mini'
                          onClick={() =>
                            manageUser(user.username, 'delete', user.id)
                          }
                        >
                          {t('user.buttons.delete_user')} {user.username}
                        </Button>
                      </Popup>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalPages > 1 && (
          <div className='user-list-footer'>
            <Pagination
              activePage={activePage}
              onPageChange={onPaginationChange}
              size='small'
              siblingRange={1}
              totalPages={totalPages}
            />
          </div>
        )}
      </div>
    </>
  );
};

export default UsersTable;
