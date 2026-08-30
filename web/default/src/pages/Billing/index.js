import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Label,
  Message,
  Table,
} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import { API, showError, timestamp2string } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { renderQuota } from '../../helpers/render';

const Billing = () => {
  const { t } = useTranslation();
  const [bills, setBills] = useState([]);
  const [balance, setBalance] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadBills = async () => {
    try {
      return await API.get(`/api/billing/self?p=${page}`);
    } catch (error) {
      if (error?.response?.status !== 404) throw error;

      // Compatibility fallback for an older backend process that does not yet
      // expose /api/billing/self. Types 1 and 4 are redemption and system grants.
      const response = await API.get(`/api/log/self?p=${page}`);
      if (response?.data?.success) {
        response.data.data = (response.data.data || []).filter(
          (log) => (log.type === 1 || log.type === 4) && log.quota > 0
        );
      }
      return response;
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [billResponse, userResponse] = await Promise.all([
        loadBills(),
        API.get('/api/user/self'),
      ]);
      if (!billResponse?.data?.success) {
        showError(billResponse?.data?.message || t('billing.load_failed'));
      } else {
        setBills(billResponse.data.data || []);
      }
      if (!userResponse?.data?.success) {
        showError(userResponse?.data?.message || t('billing.load_failed'));
      } else {
        setBalance(userResponse.data.data?.quota || 0);
      }
    } catch (error) {
      showError(error || t('billing.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().then();
  }, [page]);

  const renderSource = (type) => {
    if (type === 1) {
      return <Label color='green'>{t('billing.source.redemption')}</Label>;
    }
    return <Label color='blue'>{t('billing.source.monthly')}</Label>;
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('billing.title')}</Card.Header>
          <section className='billing-summary'>
            <span>{t('billing.current_balance')}</span>
            <strong>{renderQuota(balance, t)}</strong>
          </section>
          <Message className='page-notice' info content={t('billing.notice')} />

          <div className='page-table-wrap'>
          <Table className='app-data-table billing-data-table' basic='very' compact>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('billing.table.time')}</Table.HeaderCell>
                <Table.HeaderCell>{t('billing.table.source')}</Table.HeaderCell>
                <Table.HeaderCell>{t('billing.table.amount')}</Table.HeaderCell>
                <Table.HeaderCell>{t('billing.table.description')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {bills.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan='4' textAlign='center' className='table-empty-state'>
                    {t('billing.empty')}
                  </Table.Cell>
                </Table.Row>
              ) : (
                bills.map((bill, index) => (
                  <Table.Row key={`${bill.created_at}-${index}`}>
                    <Table.Cell>{timestamp2string(bill.created_at)}</Table.Cell>
                    <Table.Cell>{renderSource(bill.type)}</Table.Cell>
                    <Table.Cell>+{renderQuota(bill.quota, t)}</Table.Cell>
                    <Table.Cell>{bill.content}</Table.Cell>
                  </Table.Row>
                ))
              )}
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.HeaderCell className='table-footer-cell' colSpan='4'>
                  <Button
                    size='small'
                    disabled={page === 0 || loading}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    {t('billing.previous')}
                  </Button>
                  <Button
                    size='small'
                    disabled={bills.length < ITEMS_PER_PAGE || loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t('billing.next')}
                  </Button>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Footer>
          </Table>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default Billing;
