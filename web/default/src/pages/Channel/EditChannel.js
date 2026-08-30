import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Form, Message } from 'semantic-ui-react';
import { useNavigate, useParams } from 'react-router-dom';
import { API, showError, showInfo, showSuccess } from '../../helpers';

const DEEPSEEK_MODEL = 'deepseek-v4-flash';
const OPENAI_COMPATIBLE_CHANNEL = 50;

const EditChannel = () => {
  const { t } = useTranslation();
  const { id: channelId } = useParams();
  const navigate = useNavigate();
  const isEdit = channelId !== undefined;
  const initialInputs = {
    name: 'DeepSeek V4 Flash',
    type: OPENAI_COMPATIBLE_CHANNEL,
    key: '',
    base_url: '',
    models: [DEEPSEEK_MODEL],
    groups: ['default'],
    model_mapping: '',
    system_prompt: '',
    config: '{}',
  };
  const [inputs, setInputs] = useState(initialInputs);
  const [loading, setLoading] = useState(isEdit);

  const handleInputChange = (event, { name, value }) => {
    setInputs((current) => ({ ...current, [name]: value }));
  };

  useEffect(() => {
    if (!isEdit) return;
    const loadChannel = async () => {
      const res = await API.get(`/api/channel/${channelId}`);
      const { success, message, data } = res.data;
      if (success) {
        setInputs({
          ...initialInputs,
          ...data,
          type: OPENAI_COMPATIBLE_CHANNEL,
          models: [DEEPSEEK_MODEL],
          groups: ['default'],
          key: '',
        });
      } else {
        showError(message);
      }
      setLoading(false);
    };
    loadChannel().then();
  }, [channelId, isEdit]);

  const submit = async () => {
    if (!inputs.name.trim() || !inputs.base_url.trim()) {
      showInfo('请填写服务名称和 llama-server 地址');
      return;
    }
    if (!isEdit && !inputs.key.trim()) {
      showInfo('请填写 llama-server API Key；未启用鉴权时可填写 local');
      return;
    }

    let baseURL = inputs.base_url.trim().replace(/\/+$/, '');
    if (!baseURL.endsWith('/v1')) baseURL += '/v1';
    const payload = {
      ...inputs,
      type: OPENAI_COMPATIBLE_CHANNEL,
      base_url: baseURL,
      models: DEEPSEEK_MODEL,
      group: 'default',
      model_mapping: '',
      system_prompt: '',
      config: '{}',
    };

    const res = isEdit
      ? await API.put('/api/channel/', {
          ...payload,
          id: parseInt(channelId),
        })
      : await API.post('/api/channel/', payload);
    const { success, message } = res.data;
    if (!success) {
      showError(message);
      return;
    }
    showSuccess(
      isEdit
        ? t('channel.edit.messages.update_success')
        : t('channel.edit.messages.create_success')
    );
    navigate('/channel');
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content>
          <Card.Header className='header'>
            {isEdit ? '编辑 DeepSeek 模型服务' : '添加 DeepSeek 模型服务'}
          </Card.Header>
          <Message info>
            此处只连接 llama-server 的 OpenAI-compatible 接口。模型固定为
            <strong> {DEEPSEEK_MODEL}</strong>，地址示例：
            <code>http://推理容器IP:8080/v1</code>。
          </Message>
          <Form loading={loading} autoComplete='new-password'>
            <Form.Input
              label='服务名称'
              name='name'
              placeholder='例如：六卡 DeepSeek 主服务'
              value={inputs.name}
              onChange={handleInputChange}
              required
            />
            <Form.Input
              label='模型 API 名称'
              value={DEEPSEEK_MODEL}
              readOnly
            />
            <Form.Input
              label='llama-server 地址'
              name='base_url'
              placeholder='http://推理容器IP:8080/v1'
              value={inputs.base_url || ''}
              onChange={handleInputChange}
              required
            />
            <Form.Input
              label='llama-server API Key'
              name='key'
              type='password'
              placeholder={
                isEdit
                  ? '留空表示不修改现有 Key'
                  : '与 llama-server --api-key 保持一致；未启用鉴权可填写 local'
              }
              value={inputs.key}
              onChange={handleInputChange}
              required={!isEdit}
              autoComplete='new-password'
            />
            <Button onClick={() => navigate('/channel')}>
              {t('channel.edit.buttons.cancel')}
            </Button>
            <Button positive onClick={submit}>
              {t('channel.edit.buttons.submit')}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
};

export default EditChannel;
