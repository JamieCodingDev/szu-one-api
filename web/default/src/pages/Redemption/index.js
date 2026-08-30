import React from 'react';
import { Card } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import RedemptionsTable from '../../components/RedemptionsTable';
import { isAdmin } from '../../helpers';
import TopUp from '../TopUp';

const Redemption = () => {
  const { t } = useTranslation();

  if (!isAdmin()) {
    return <TopUp />;
  }

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('redemption.title')}</Card.Header>
          <RedemptionsTable />
        </Card.Content>
      </Card>
    </div>
  );
};

export default Redemption;
