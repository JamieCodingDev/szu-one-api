import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Label,
  Popup,
  Pagination,
  Table,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import {
  API,
  copy,
  showError,
  showSuccess,
  showWarning,
  timestamp2string,
} from '../helpers';

import { ITEMS_PER_PAGE } from '../constants';
import { renderQuota } from '../helpers/render';

function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

function renderStatus(status, t) {
  switch (status) {
    case 1:
      return (
        <Label basic color='green'>
          {t('redemption.status.unused')}
        </Label>
      );
    case 2:
      return (
        <Label basic color='red'>
          {t('redemption.status.disabled')}
        </Label>
      );
    case 3:
      return (
        <Label basic color='grey'>
          {t('redemption.status.used')}
        </Label>
      );
    default:
      return (
        <Label basic color='black'>
          {t('redemption.status.unknown')}
        </Label>
      );
  }
}

const RedemptionsTable = () => {
  const { t } = useTranslation();
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);

  const loadRedemptions = async (startIdx) => {
    const res = await API.get(`/api/redemption/?p=${startIdx}`);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setRedemptions(data);
      } else {
        let newRedemptions = redemptions;
        newRedemptions.push(...data);
        setRedemptions(newRedemptions);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(redemptions.length / ITEMS_PER_PAGE) + 1) {
        // In this case we have to load more data and then append them.
        await loadRedemptions(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  useEffect(() => {
    loadRedemptions(0)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  const manageRedemption = async (id, action, idx) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/redemption/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/redemption/?status_only=true', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/redemption/?status_only=true', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('token.messages.operation_success'));
      let redemption = res.data.data;
      let newRedemptions = [...redemptions];
      let realIdx = (activePage - 1) * ITEMS_PER_PAGE + idx;
      if (action === 'delete') {
        newRedemptions.splice(realIdx, 1);
      } else {
        newRedemptions[realIdx].status = redemption.status;
      }
      setRedemptions(newRedemptions);
    } else {
      showError(message);
    }
  };

  const sortRedemption = (key) => {
    if (redemptions.length === 0) return;
    setLoading(true);
    let sortedRedemptions = [...redemptions];
    sortedRedemptions.sort((a, b) => {
      if (!isNaN(a[key])) {
        // If the value is numeric, subtract to sort
        return a[key] - b[key];
      } else {
        // If the value is not numeric, sort as strings
        return ('' + a[key]).localeCompare(b[key]);
      }
    });
    if (sortedRedemptions[0].id === redemptions[0].id) {
      sortedRedemptions.reverse();
    }
    setRedemptions(sortedRedemptions);
    setLoading(false);
  };

  const refresh = async () => {
    setLoading(true);
    await loadRedemptions(0);
    setActivePage(1);
  };

  return (
    <>
      <div className='page-table-wrap'>
      <Table className='app-data-table redemption-data-table' basic={'very'} compact size='small'>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>
              {t('redemption.table.id')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortRedemption('status');
              }}
            >
              {t('redemption.table.status')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortRedemption('quota');
              }}
            >
              {t('redemption.table.quota')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortRedemption('created_time');
              }}
            >
              {t('redemption.table.created_time')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortRedemption('redeemed_time');
              }}
            >
              {t('redemption.table.redeemed_time')}
            </Table.HeaderCell>
            <Table.HeaderCell>{t('redemption.table.actions')}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {redemptions.length === 0 && !loading && (
            <Table.Row>
              <Table.Cell colSpan='6' textAlign='center' className='table-empty-state'>
                {t('redemption.table.empty')}
              </Table.Cell>
            </Table.Row>
          )}
          {redemptions
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((redemption, idx) => {
              return (
                <Table.Row key={redemption.id}>
                  <Table.Cell>
                    {(activePage - 1) * ITEMS_PER_PAGE + idx + 1}
                  </Table.Cell>
                  <Table.Cell>{renderStatus(redemption.status, t)}</Table.Cell>
                  <Table.Cell>{renderQuota(redemption.quota, t)}</Table.Cell>
                  <Table.Cell>
                    {renderTimestamp(redemption.created_time)}
                  </Table.Cell>
                  <Table.Cell>
                    {redemption.redeemed_time
                      ? renderTimestamp(redemption.redeemed_time)
                      : t('redemption.table.not_redeemed')}{' '}
                  </Table.Cell>
                  <Table.Cell>
                    <div>
                      <Button
                        size={'tiny'}
                        positive
                        onClick={async () => {
                          if (await copy(redemption.key)) {
                            showSuccess(t('token.messages.copy_success'));
                          } else {
                            showWarning(t('token.messages.copy_failed'));
                          }
                        }}
                      >
                        {t('redemption.buttons.copy')}
                      </Button>
                      <Popup
                        trigger={
                          <Button size='tiny' negative>
                            {t('redemption.buttons.delete')}
                          </Button>
                        }
                        on='click'
                        flowing
                        hoverable
                      >
                        <Button
                          negative
                          onClick={() => {
                            manageRedemption(redemption.id, 'delete', idx);
                          }}
                        >
                          {t('redemption.buttons.confirm_delete')}
                        </Button>
                      </Popup>
                      <Button
                        size={'tiny'}
                        disabled={redemption.status === 3} // used
                        onClick={() => {
                          manageRedemption(
                            redemption.id,
                            redemption.status === 1 ? 'disable' : 'enable',
                            idx
                          );
                        }}
                      >
                        {redemption.status === 1
                          ? t('redemption.buttons.disable')
                          : t('redemption.buttons.enable')}
                      </Button>
                      <Button
                        size={'tiny'}
                        as={Link}
                        to={'/redemption/edit/' + redemption.id}
                      >
                        {t('redemption.buttons.edit')}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell className='table-footer-cell' colSpan='6'>
              <Button
                size='small'
                as={Link}
                to='/redemption/add'
                loading={loading}
              >
                {t('redemption.buttons.add')}
              </Button>
              <Button size='small' onClick={refresh} loading={loading}>
                {t('redemption.buttons.refresh')}
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(redemptions.length / ITEMS_PER_PAGE) +
                  (redemptions.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
                }
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
      </div>
    </>
  );
};

export default RedemptionsTable;
