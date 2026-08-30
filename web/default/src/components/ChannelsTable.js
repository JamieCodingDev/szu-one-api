import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Label,
  Popup,
  Table,
} from 'semantic-ui-react';
import { Link } from 'react-router-dom';
import { API, showError, showSuccess } from '../helpers';

const DEEPSEEK_MODEL = 'deepseek-v4-flash';

const ChannelsTable = () => {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');

  const loadChannels = async (page = 0) => {
    setLoading(true);
    const res = await API.get(`/api/channel/?p=${page}`);
    const { success, message, data } = res.data;
    if (success) {
      setChannels(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChannels(0).then();
  }, []);

  const searchChannels = async () => {
    if (!searchKeyword) {
      await loadChannels(0);
      return;
    }
    setLoading(true);
    const res = await API.get(
      `/api/channel/search?keyword=${encodeURIComponent(searchKeyword)}`
    );
    const { success, message, data } = res.data;
    if (success) {
      setChannels(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };

  const updateChannel = async (channel, action) => {
    let res;
    if (action === 'delete') {
      res = await API.delete(`/api/channel/${channel.id}`);
    } else {
      res = await API.put('/api/channel/', {
        id: channel.id,
        status: action === 'enable' ? 1 : 2,
      });
    }
    const { success, message, data } = res.data;
    if (!success) {
      showError(message);
      return;
    }
    showSuccess('操作成功');
    if (action === 'delete') {
      setChannels((current) =>
        current.filter((item) => item.id !== channel.id)
      );
    } else {
      setChannels((current) =>
        current.map((item) => (item.id === channel.id ? data : item))
      );
    }
  };

  const testChannel = async (channel) => {
    const res = await API.get(
      `/api/channel/test/${channel.id}?model=${DEEPSEEK_MODEL}`
    );
    const { success, message, time } = res.data;
    if (success) {
      showSuccess(`连接成功，响应耗时 ${time} 秒`);
      setChannels((current) =>
        current.map((item) =>
          item.id === channel.id
            ? { ...item, response_time: time * 1000 }
            : item
        )
      );
    } else {
      showError(message);
    }
  };

  const renderStatus = (status) => {
    if (status === 1) return <Label color='green'>已启用</Label>;
    if (status === 2) return <Label color='red'>已停用</Label>;
    if (status === 3) return <Label color='orange'>自动停用</Label>;
    return <Label>未知</Label>;
  };

  const renderResponseTime = (milliseconds) => {
    if (!milliseconds) return '尚未测试';
    return `${(milliseconds / 1000).toFixed(2)} 秒`;
  };

  return (
    <>
      <Form onSubmit={searchChannels}>
        <Form.Input
          icon='search'
          fluid
          iconPosition='left'
          placeholder='搜索 DeepSeek 服务名称'
          value={searchKeyword}
          onChange={(event, { value }) => setSearchKeyword(value.trim())}
        />
      </Form>

      <Table basic='very' compact size='small'>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>ID</Table.HeaderCell>
            <Table.HeaderCell>服务名称</Table.HeaderCell>
            <Table.HeaderCell>llama-server 地址</Table.HeaderCell>
            <Table.HeaderCell>模型 API 名称</Table.HeaderCell>
            <Table.HeaderCell>状态</Table.HeaderCell>
            <Table.HeaderCell>响应时间</Table.HeaderCell>
            <Table.HeaderCell>操作</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {channels.map((channel) => (
            <Table.Row key={channel.id}>
              <Table.Cell>{channel.id}</Table.Cell>
              <Table.Cell>{channel.name || 'DeepSeek V4 Flash'}</Table.Cell>
              <Table.Cell>{channel.base_url || '-'}</Table.Cell>
              <Table.Cell>{DEEPSEEK_MODEL}</Table.Cell>
              <Table.Cell>{renderStatus(channel.status)}</Table.Cell>
              <Table.Cell>
                {renderResponseTime(channel.response_time)}
              </Table.Cell>
              <Table.Cell>
                <Button
                  size='tiny'
                  positive
                  disabled={channel.status !== 1}
                  onClick={() => testChannel(channel)}
                >
                  测试连接
                </Button>
                <Button
                  size='tiny'
                  onClick={() =>
                    updateChannel(
                      channel,
                      channel.status === 1 ? 'disable' : 'enable'
                    )
                  }
                >
                  {channel.status === 1 ? '停用' : '启用'}
                </Button>
                <Button
                  size='tiny'
                  as={Link}
                  to={`/channel/edit/${channel.id}`}
                >
                  编辑
                </Button>
                <Popup
                  on='click'
                  flowing
                  hoverable
                  trigger={
                    <Button size='tiny' negative>
                      删除
                    </Button>
                  }
                >
                  <Button
                    size='tiny'
                    negative
                    onClick={() => updateChannel(channel, 'delete')}
                  >
                    确认删除 {channel.name}
                  </Button>
                </Popup>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
        <Table.Footer>
          <Table.Row>
            <Table.HeaderCell colSpan='7'>
              <Button
                primary
                size='small'
                as={Link}
                to='/channel/add'
              >
                添加 DeepSeek 服务
              </Button>
              <Button size='small' onClick={() => loadChannels(0)}>
                刷新
              </Button>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Footer>
      </Table>
      {!loading && channels.length === 0 && (
        <Label basic>尚未配置 llama-server，请点击“添加 DeepSeek 服务”。</Label>
      )}
    </>
  );
};

export default ChannelsTable;
