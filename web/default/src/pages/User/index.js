import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Message } from 'semantic-ui-react';
import UsersTable from '../../components/UsersTable';

const User = () => {
  const { t } = useTranslation();

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('user.title')}</Card.Header>
          <Message className='page-notice' info content={t('user.admin_notice')} />
          <UsersTable />
        </Card.Content>
      </Card>
    </div>
  );
};

export default User;
