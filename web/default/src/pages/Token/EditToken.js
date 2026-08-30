import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Form,
  Message,
  Card,
} from 'semantic-ui-react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  API,
  showError,
  showSuccess,
} from '../../helpers';

const FIXED_MODEL = 'deepseek-v4-flash';

const EditToken = () => {
  const { t } = useTranslation();
  const params = useParams();
  const tokenId = params.id;
  const isEdit = tokenId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const originInputs = {
    name: '',
    models: FIXED_MODEL,
    subnet: '',
  };
  const [inputs, setInputs] = useState(originInputs);
  const { name } = inputs;
  const navigate = useNavigate();
  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };
  const handleCancel = () => {
    navigate('/token');
  };
  const loadToken = async () => {
    try {
      let res = await API.get(`/api/token/${tokenId}`);
      const { success, message, data } = res.data || {};
      if (success && data) {
        setInputs({ ...data, models: FIXED_MODEL });
      } else {
        showError(message || 'Failed to load token');
      }
    } catch (error) {
      showError(error.message || 'Network error');
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isEdit) {
      loadToken().catch((error) => {
        showError(error.message || 'Failed to load token');
        setLoading(false);
      });
    }
  }, []);

  const submit = async () => {
    if (!isEdit && inputs.name === '') return;
    const localInputs = {
      ...inputs,
      models: FIXED_MODEL,
    };
    let res;
    if (isEdit) {
      res = await API.put(`/api/token/`, {
        ...localInputs,
        id: parseInt(tokenId),
      });
    } else {
      res = await API.post(`/api/token/`, localInputs);
    }
    const { success, message } = res.data;
    if (success) {
      if (isEdit) {
        showSuccess(t('token.edit.messages.update_success'));
      } else {
        showSuccess(t('token.edit.messages.create_success'));
        setInputs(originInputs);
      }
    } else {
      showError(message);
    }
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>
            {isEdit ? t('token.edit.title_edit') : t('token.edit.title_create')}
          </Card.Header>
          <Form className='page-form' loading={loading} autoComplete='new-password'>
            <Form.Field>
              <Form.Input
                label={t('token.edit.name')}
                name='name'
                placeholder={t('token.edit.name_placeholder')}
                onChange={handleInputChange}
                value={name}
                autoComplete='new-password'
                required={!isEdit}
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('token.edit.models')}
                name='models'
                value={FIXED_MODEL}
                readOnly
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('token.edit.ip_limit')}
                name='subnet'
                placeholder={t('token.edit.ip_limit_placeholder')}
                onChange={handleInputChange}
                value={inputs.subnet}
                autoComplete='new-password'
              />
            </Form.Field>
            <Message className='page-notice' info>
              {t('token.edit.ip_limit_notice')}
            </Message>
            <Message className='page-notice' info>{t('token.edit.shared_account_notice')}</Message>
            <Button floated='right' positive onClick={submit}>
              {t('token.edit.buttons.submit')}
            </Button>
            <Button floated='right' onClick={handleCancel}>
              {t('token.edit.buttons.cancel')}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
};

export default EditToken;
