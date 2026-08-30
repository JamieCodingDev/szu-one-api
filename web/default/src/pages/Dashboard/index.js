import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table } from 'semantic-ui-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { API, showError, timestamp2string } from '../../helpers';
import { ITEMS_PER_PAGE } from '../../constants';
import { renderQuota } from '../../helpers/render';
import './Dashboard.css';

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  const [, month, day] = value.split('-');
  return `${Number(month)}/${Number(day)}`;
};

const formatNumber = (value) =>
  new Intl.NumberFormat().format(Number(value) || 0);

const Dashboard = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [account, setAccount] = useState({ quota: 0, usedQuota: 0 });
  const [details, setDetails] = useState([]);
  const [detailPage, setDetailPage] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const [dashboardResponse, userResponse] = await Promise.all([
          API.get('/api/user/dashboard'),
          API.get('/api/user/self'),
        ]);

        if (!dashboardResponse.data.success) {
          throw new Error(dashboardResponse.data.message);
        }
        if (!userResponse.data.success) {
          throw new Error(userResponse.data.message);
        }

        setLogs(dashboardResponse.data.data || []);
        setAccount({
          quota: userResponse.data.data.quota || 0,
          usedQuota: userResponse.data.data.used_quota || 0,
        });
      } catch (error) {
        showError(error.message || t('dashboard.load_failed'));
      }
    };

    loadUsage().then();
  }, [t]);

  const loadDetails = useCallback(async () => {
    setDetailLoading(true);
    try {
      const response = await API.get(`/api/usage/self?p=${detailPage}`);
      if (!response.data.success) {
        throw new Error(response.data.message);
      }
      setDetails(response.data.data || []);
    } catch (error) {
      showError(error.message || t('dashboard.details.load_failed'));
    } finally {
      setDetailLoading(false);
    }
  }, [detailPage, t]);

  useEffect(() => {
    loadDetails().then();
  }, [loadDetails]);

  const usage = useMemo(() => {
    const days = {};
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = toDateKey(date);
      days[key] = {
        date: key,
        requests: 0,
        quota: 0,
        promptTokens: 0,
        completionTokens: 0,
        tokens: 0,
      };
    }

    logs.forEach((item) => {
      if (!days[item.day]) return;
      const promptTokens = Number(item.prompt_tokens) || 0;
      const completionTokens = Number(item.completion_tokens) || 0;
      days[item.day].requests += Number(item.request_count) || 0;
      days[item.day].quota += Number(item.quota) || 0;
      days[item.day].promptTokens += promptTokens;
      days[item.day].completionTokens += completionTokens;
      days[item.day].tokens += promptTokens + completionTokens;
    });

    const timeline = Object.values(days);
    return {
      timeline,
      requests: timeline.reduce((sum, item) => sum + item.requests, 0),
      quota: timeline.reduce((sum, item) => sum + item.quota, 0),
      tokens: timeline.reduce((sum, item) => sum + item.tokens, 0),
    };
  }, [logs]);

  const tooltipStyle = {
    background: '#26282b',
    border: '1px solid #45474c',
    borderRadius: '10px',
    color: '#f4f5f6',
  };

  return (
    <main className='usage-page'>
      <header className='usage-heading'>
        <h1>{t('dashboard.title')}</h1>
        <p>{t('dashboard.subtitle')}</p>
      </header>

      <section className='usage-notice'>
        <span>{t('dashboard.notice')}</span>
      </section>

      <section className='usage-balance-grid'>
        <article className='usage-card usage-balance-card'>
          <span>{t('dashboard.summary.balance')}</span>
          <strong>{renderQuota(account.quota, t)}</strong>
        </article>
        <article className='usage-card usage-balance-card'>
          <span>{t('dashboard.summary.total_used')}</span>
          <strong>{renderQuota(account.usedQuota, t)}</strong>
        </article>
      </section>

      <div className='usage-divider' />

      <section className='usage-filter-row' aria-label={t('dashboard.range')}>
        <span className='usage-filter-label'>{t('dashboard.range')}</span>
        <strong>{t('dashboard.last_7_days')}</strong>
        <span className='usage-filter-separator' />
        <span className='usage-filter-label'>API Key</span>
        <strong>{t('dashboard.all_keys')}</strong>
      </section>

      <section className='usage-metric-grid'>
        <article className='usage-card usage-metric-card'>
          <span>{t('dashboard.period.quota')}</span>
          <strong>{renderQuota(usage.quota, t)}</strong>
        </article>
        <article className='usage-card usage-metric-card'>
          <span>{t('dashboard.period.requests')}</span>
          <strong>{formatNumber(usage.requests)}</strong>
        </article>
        <article className='usage-card usage-metric-card'>
          <span>{t('dashboard.period.tokens')}</span>
          <strong>{formatNumber(usage.tokens)}</strong>
        </article>
      </section>

      <section className='usage-card usage-chart-card usage-main-chart'>
        <div className='usage-chart-title'>
          <span>{t('dashboard.charts.quota.title')}</span>
          <strong>{renderQuota(usage.quota, t)}</strong>
        </div>
        <ResponsiveContainer width='100%' height={310}>
          <BarChart data={usage.timeline} margin={{ top: 20, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke='#4b4d51' opacity={0.45} />
            <XAxis dataKey='date' tickFormatter={formatDate} stroke='#8f9298' tickLine={false} />
            <YAxis stroke='#8f9298' tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelFormatter={formatDate}
              formatter={(value) => [renderQuota(value, t), t('dashboard.charts.quota.tooltip')]}
            />
            <Bar dataKey='quota' fill='#ff6412' radius={[5, 5, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className='usage-model-section'>
        <h2>DeepSeek V4 Flash</h2>
        <div className='usage-model-grid'>
          <article className='usage-card usage-chart-card'>
            <div className='usage-chart-title'>
              <span>{t('dashboard.period.requests')}</span>
              <strong>{formatNumber(usage.requests)}</strong>
            </div>
            <ResponsiveContainer width='100%' height={230}>
              <LineChart data={usage.timeline} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke='#4b4d51' opacity={0.45} />
                <XAxis dataKey='date' tickFormatter={formatDate} stroke='#8f9298' tickLine={false} />
                <YAxis stroke='#8f9298' tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} />
                <Line type='monotone' dataKey='requests' stroke='#3184ff' strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </article>

          <article className='usage-card usage-chart-card'>
            <div className='usage-chart-title'>
              <span>{t('dashboard.period.tokens')}</span>
              <strong>{formatNumber(usage.tokens)}</strong>
            </div>
            <ResponsiveContainer width='100%' height={230}>
              <BarChart data={usage.timeline} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke='#4b4d51' opacity={0.45} />
                <XAxis dataKey='date' tickFormatter={formatDate} stroke='#8f9298' tickLine={false} />
                <YAxis stroke='#8f9298' tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDate} />
                <Bar dataKey='promptTokens' stackId='tokens' fill='#2776eb' maxBarSize={24} />
                <Bar dataKey='completionTokens' stackId='tokens' fill='#91d8ff' radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        </div>
      </section>

      <section className='usage-card usage-detail-card'>
        <div className='usage-detail-heading'>
          <div>
            <h2>{t('dashboard.details.title')}</h2>
            <p>{t('dashboard.details.subtitle')}</p>
          </div>
        </div>
        <div className='usage-detail-table-wrap'>
          <Table className='app-data-table usage-detail-table' basic='very' compact>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>{t('dashboard.details.table.time')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.api_key')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.input_tokens')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.output_tokens')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.total_tokens')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.quota')}</Table.HeaderCell>
                <Table.HeaderCell>{t('dashboard.details.table.elapsed')}</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {details.length === 0 ? (
                <Table.Row>
                  <Table.Cell colSpan='7' textAlign='center' className='table-empty-state'>
                    {t('dashboard.details.empty')}
                  </Table.Cell>
                </Table.Row>
              ) : (
                details.map((detail, index) => {
                  const promptTokens = Number(detail.prompt_tokens) || 0;
                  const completionTokens = Number(detail.completion_tokens) || 0;
                  return (
                    <Table.Row key={`${detail.request_id || detail.created_at}-${index}`}>
                      <Table.Cell>{timestamp2string(detail.created_at)}</Table.Cell>
                      <Table.Cell>{detail.token_name || '-'}</Table.Cell>
                      <Table.Cell>{formatNumber(promptTokens)}</Table.Cell>
                      <Table.Cell>{formatNumber(completionTokens)}</Table.Cell>
                      <Table.Cell>{formatNumber(promptTokens + completionTokens)}</Table.Cell>
                      <Table.Cell>{renderQuota(detail.quota, t)}</Table.Cell>
                      <Table.Cell>{detail.elapsed_time ? `${formatNumber(detail.elapsed_time)} ms` : '-'}</Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
            <Table.Footer>
              <Table.Row>
                <Table.HeaderCell colSpan='7' className='usage-detail-footer'>
                  <Button
                    size='small'
                    disabled={detailPage === 0 || detailLoading}
                    onClick={() => setDetailPage((current) => current - 1)}
                  >
                    {t('dashboard.details.previous')}
                  </Button>
                  <Button
                    size='small'
                    disabled={details.length < ITEMS_PER_PAGE || detailLoading}
                    onClick={() => setDetailPage((current) => current + 1)}
                  >
                    {t('dashboard.details.next')}
                  </Button>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Footer>
          </Table>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;
