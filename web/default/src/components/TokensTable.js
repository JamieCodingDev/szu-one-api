import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dropdown,
  Form,
  Label,
  Message,
  Pagination,
  Popup,
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

function renderTimestamp(timestamp) {
  return <>{timestamp2string(timestamp)}</>;
}

function renderStatus(status, t) {
  switch (status) {
    case 1:
      return (
        <Label basic color='green'>
          {t('token.table.status_enabled')}
        </Label>
      );
    case 2:
      return (
        <Label basic color='red'>
          {t('token.table.status_disabled')}
        </Label>
      );
    case 3:
      return (
        <Label basic color='yellow'>
          {t('token.table.status_expired')}
        </Label>
      );
    case 4:
      return (
        <Label basic color='grey'>
          {t('token.table.status_depleted')}
        </Label>
      );
    default:
      return (
        <Label basic color='black'>
          {t('token.table.status_unknown')}
        </Label>
      );
  }
}

const TokensTable = () => {
  const { t } = useTranslation();

  const COPY_OPTIONS = [
    { key: 'raw', text: t('token.copy_options.raw'), value: '' },
    { key: 'next', text: t('token.copy_options.next'), value: 'next' },
    { key: 'ama', text: t('token.copy_options.ama'), value: 'ama' },
    { key: 'opencat', text: t('token.copy_options.opencat'), value: 'opencat' },
    { key: 'lobe', text: t('token.copy_options.lobe'), value: 'lobechat' },
  ];

  const OPEN_LINK_OPTIONS = [
    { key: 'next', text: t('token.copy_options.next'), value: 'next' },
    { key: 'ama', text: t('token.copy_options.ama'), value: 'ama' },
    { key: 'opencat', text: t('token.copy_options.opencat'), value: 'opencat' },
    { key: 'lobe', text: t('token.copy_options.lobe'), value: 'lobechat' },
  ];

  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(1);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [targetTokenIdx, setTargetTokenIdx] = useState(0);

  const loadTokens = async (startIdx) => {
    const res = await API.get(`/api/token/?p=${startIdx}`);
    const { success, message, data } = res.data;
    if (success) {
      if (startIdx === 0) {
        setTokens(data);
      } else {
        let newTokens = [...tokens];
        newTokens.splice(startIdx * ITEMS_PER_PAGE, data.length, ...data);
        setTokens(newTokens);
      }
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const onPaginationChange = (e, { activePage }) => {
    (async () => {
      if (activePage === Math.ceil(tokens.length / ITEMS_PER_PAGE) + 1) {
        // In this case we have to load more data and then append them.
        await loadTokens(activePage - 1);
      }
      setActivePage(activePage);
    })();
  };

  const refresh = async () => {
    setLoading(true);
    await loadTokens(activePage - 1);
  };

  const onCopy = async (type, key) => {
    let status = localStorage.getItem('status');
    let serverAddress = '';
    if (status) {
      status = JSON.parse(status);
      serverAddress = status.server_address;
    }
    if (serverAddress === '') {
      serverAddress = window.location.origin;
    }
    let encodedServerAddress = encodeURIComponent(serverAddress);
    const nextLink = localStorage.getItem('chat_link');
    let nextUrl;

    if (nextLink) {
      nextUrl =
        nextLink + `/#/?settings={"key":"sk-${key}","url":"${serverAddress}"}`;
    } else {
      nextUrl = `https://app.nextchat.dev/#/?settings={"key":"sk-${key}","url":"${serverAddress}"}`;
    }

    let url;
    switch (type) {
      case 'ama':
        url = `ama://set-api-key?server=${encodedServerAddress}&key=sk-${key}`;
        break;
      case 'opencat':
        url = `opencat://team/join?domain=${encodedServerAddress}&token=sk-${key}`;
        break;
      case 'next':
        url = nextUrl;
        break;
      case 'lobechat':
        url =
          nextLink +
          `/?settings={"keyVaults":{"openai":{"apiKey":"sk-${key}","baseURL":"${serverAddress}/v1"}}}`;
        break;
      default:
        url = `sk-${key}`;
    }
    if (await copy(url)) {
      showSuccess(t('token.messages.copy_success'));
    } else {
      showWarning(t('token.messages.copy_failed'));
      setSearchKeyword(url);
    }
  };

  const onOpenLink = async (type, key) => {
    let status = localStorage.getItem('status');
    let serverAddress = '';
    if (status) {
      status = JSON.parse(status);
      serverAddress = status.server_address;
    }
    if (serverAddress === '') {
      serverAddress = window.location.origin;
    }
    let encodedServerAddress = encodeURIComponent(serverAddress);
    const chatLink = localStorage.getItem('chat_link');
    let defaultUrl;

    if (chatLink) {
      defaultUrl =
        chatLink + `/#/?settings={"key":"sk-${key}","url":"${serverAddress}"}`;
    } else {
      defaultUrl = `https://app.nextchat.dev/#/?settings={"key":"sk-${key}","url":"${serverAddress}"}`;
    }
    let url;
    switch (type) {
      case 'ama':
        url = `ama://set-api-key?server=${encodedServerAddress}&key=sk-${key}`;
        break;

      case 'opencat':
        url = `opencat://team/join?domain=${encodedServerAddress}&token=sk-${key}`;
        break;

      case 'lobechat':
        url =
          chatLink +
          `/?settings={"keyVaults":{"openai":{"apiKey":"sk-${key}","baseURL":"${serverAddress}/v1"}}}`;
        break;

      default:
        url = defaultUrl;
    }

    window.open(url, '_blank');
  };

  useEffect(() => {
    loadTokens(0)
      .then()
      .catch((reason) => {
        showError(reason);
      });
  }, []);

  const manageToken = async (id, action, idx) => {
    let data = { id };
    let res;
    switch (action) {
      case 'delete':
        res = await API.delete(`/api/token/${id}/`);
        break;
      case 'enable':
        data.status = 1;
        res = await API.put('/api/token/?status_only=true', data);
        break;
      case 'disable':
        data.status = 2;
        res = await API.put('/api/token/?status_only=true', data);
        break;
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('token.messages.operation_success'));
      let token = res.data.data;
      let newTokens = [...tokens];
      let realIdx = (activePage - 1) * ITEMS_PER_PAGE + idx;
      if (action === 'delete') {
        newTokens[realIdx].deleted = true;
      } else {
        newTokens[realIdx].status = token.status;
      }
      setTokens(newTokens);
    } else {
      showError(message);
    }
  };

  const searchTokens = async () => {
    if (searchKeyword === '') {
      // if keyword is blank, load files instead.
      await loadTokens(0);
      setActivePage(1);
      return;
    }
    setSearching(true);
    const res = await API.get(`/api/token/search?keyword=${searchKeyword}`);
    const { success, message, data } = res.data;
    if (success) {
      setTokens(data);
      setActivePage(1);
    } else {
      showError(message);
    }
    setSearching(false);
  };

  const handleKeywordChange = async (e, { value }) => {
    setSearchKeyword(value.trim());
  };

  const sortToken = (key) => {
    if (tokens.length === 0) return;
    setLoading(true);
    let sortedTokens = [...tokens];
    sortedTokens.sort((a, b) => {
      if (!isNaN(a[key])) {
        // If the value is numeric, subtract to sort
        return a[key] - b[key];
      } else {
        // If the value is not numeric, sort as strings
        return ('' + a[key]).localeCompare(b[key]);
      }
    });
    if (sortedTokens[0].id === tokens[0].id) {
      sortedTokens.reverse();
    }
    setTokens(sortedTokens);
    setLoading(false);
  };

  return (
    <>
      <Form className='page-toolbar' onSubmit={searchTokens}>
        <Form.Input
          icon='search'
          fluid
          iconPosition='left'
          placeholder={t('token.search')}
          value={searchKeyword}
          loading={searching}
          onChange={handleKeywordChange}
        />
      </Form>
      <Message className='page-notice' info content={t('token.shared_account_notice')} />

      <div className='page-table-wrap'>
      <Table className='app-data-table token-data-table' basic={'very'} compact size='small'>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('name');
              }}
            >
              {t('token.table.name')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('status');
              }}
            >
              {t('token.table.status')}
            </Table.HeaderCell>
            <Table.HeaderCell
              style={{ cursor: 'pointer' }}
              onClick={() => {
                sortToken('created_time');
              }}
            >
              {t('token.table.created_time')}
            </Table.HeaderCell>
            <Table.HeaderCell>{t('token.table.actions')}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>

        <Table.Body>
          {tokens.length === 0 && !loading && (
            <Table.Row>
              <Table.Cell colSpan='4' textAlign='center' className='table-empty-state'>
                {t('token.table.empty')}
              </Table.Cell>
            </Table.Row>
          )}
          {tokens
            .slice(
              (activePage - 1) * ITEMS_PER_PAGE,
              activePage * ITEMS_PER_PAGE
            )
            .map((token, idx) => {
              if (token.deleted) return <></>;

              const copyOptionsWithHandlers = COPY_OPTIONS.map((option) => ({
                ...option,
                onClick: async () => {
                  await onCopy(option.value, token.key);
                },
              }));

              const openLinkOptionsWithHandlers = OPEN_LINK_OPTIONS.map(
                (option) => ({
                  ...option,
                  onClick: async () => {
                    await onOpenLink(option.value, token.key);
                  },
                })
              );

              return (
                <Table.Row key={token.id}>
                  <Table.Cell>
                    {token.name ? token.name : t('token.table.no_name')}
                  </Table.Cell>
                  <Table.Cell>{renderStatus(token.status, t)}</Table.Cell>
                  <Table.Cell>{renderTimestamp(token.created_time)}</Table.Cell>
                  <Table.Cell>
                    <div>
                      <Button.Group color='green' size={'tiny'}>
                        <Button
                          size={'tiny'}
                          positive
                          onClick={async () => await onCopy('', token.key)}
                        >
                          {t('token.buttons.copy')}
                        </Button>
                        <Dropdown
                          className='button icon'
                          floating
                          options={copyOptionsWithHandlers}
                          trigger={<></>}
                        />
                      </Button.Group>{' '}
                      <Button.Group color='olive' size={'tiny'}>
                        <Button
                          size={'tiny'}
                          positive
                          onClick={() => onOpenLink('', token.key)}
                        >
                          {t('token.buttons.chat')}
                        </Button>
                        <Dropdown
                          className='button icon'
                          floating
                          options={openLinkOptionsWithHandlers}
                          trigger={<></>}
                        />
                      </Button.Group>{' '}
                      <Popup
                        trigger={
                          <Button size='mini' negative>
                            {t('token.buttons.delete')}
                          </Button>
                        }
                        on='click'
                        flowing
                        hoverable
                      >
                        <Button
                          size={'tiny'}
                          negative
                          onClick={() => {
                            manageToken(token.id, 'delete', idx);
                          }}
                        >
                          {t('token.buttons.confirm_delete')} {token.name}
                        </Button>
                      </Popup>
                      <Button
                        size={'tiny'}
                        onClick={() => {
                          manageToken(
                            token.id,
                            token.status === 1 ? 'disable' : 'enable',
                            idx
                          );
                        }}
                      >
                        {token.status === 1
                          ? t('token.buttons.disable')
                          : t('token.buttons.enable')}
                      </Button>
                      <Button
                        size={'tiny'}
                        as={Link}
                        to={'/token/edit/' + token.id}
                      >
                        {t('token.buttons.edit')}
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              );
            })}
        </Table.Body>

        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell className='table-footer-cell' colSpan='4'>
              <Button size='small' as={Link} to='/token/add' loading={loading}>
                {t('token.buttons.add')}
              </Button>
              <Button size='small' onClick={refresh} loading={loading}>
                {t('token.buttons.refresh')}
              </Button>
              <Pagination
                floated='right'
                activePage={activePage}
                onPageChange={onPaginationChange}
                size='small'
                siblingRange={1}
                totalPages={
                  Math.ceil(tokens.length / ITEMS_PER_PAGE) +
                  (tokens.length % ITEMS_PER_PAGE === 0 ? 1 : 0)
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

export default TokensTable;
