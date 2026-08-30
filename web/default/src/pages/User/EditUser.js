import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Card } from 'semantic-ui-react';
import { useParams, useNavigate } from 'react-router-dom';
import { API, isRoot, showError, showSuccess } from '../../helpers';
import { renderQuotaWithPrompt } from '../../helpers/render';

const EditUser = () => {
  const { t } = useTranslation();
  const params = useParams();
  const userId = params.id;
  const [loading, setLoading] = useState(true);
  const [inputs, setInputs] = useState({
    username: '',
    display_name: '',
    password: '',
    quota: 0,
    role: 1,
    status: 1,
  });
  const { username, display_name, password, quota, role } = inputs;
  const roleOptions = [
    { key: 1, text: t('user.table.role_types.student'), value: 1 },
    { key: 5, text: t('user.table.role_types.teacher'), value: 5 },
  ];
  if (isRoot()) {
    roleOptions.push({
      key: 10,
      text: t('user.table.role_types.admin'),
      value: 10,
    });
  }
  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };
  const navigate = useNavigate();
  const handleCancel = () => {
    navigate('/user');
  };
  const loadUser = async () => {
    let res = undefined;
    if (userId) {
      res = await API.get(`/api/user/${userId}`);
    } else {
      res = await API.get(`/api/user/self`);
    }
    const { success, message, data } = res.data;
    if (success) {
      setInputs({
        username: data.username || '',
        display_name: data.display_name || '',
        password: '',
        quota: data.quota || 0,
        role: data.role || 1,
        status: data.status || 1,
      });
    } else {
      showError(message);
    }
    setLoading(false);
  };
  useEffect(() => {
    loadUser().then();
  }, []);

  const submit = async () => {
    let res = undefined;
    if (userId) {
      let data = {
        id: parseInt(userId),
        username: inputs.username,
        display_name: inputs.display_name,
        password: inputs.password,
        quota: inputs.quota,
        role: inputs.role,
        status: inputs.status,
      };
      if (typeof data.quota === 'string') {
        data.quota = parseInt(data.quota);
      }
      res = await API.put(`/api/user/`, data);
    } else {
      res = await API.put(`/api/user/self`, inputs);
    }
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('user.messages.update_success'));
    } else {
      showError(message);
    }
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('user.edit.title')}</Card.Header>
          <Form className='page-form' loading={loading} autoComplete='new-password'>
            <Form.Field>
              <Form.Input
                label={t('user.edit.username')}
                name='username'
                placeholder={t('user.edit.username_placeholder')}
                onChange={handleInputChange}
                value={username}
                autoComplete='new-password'
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('user.edit.password')}
                name='password'
                type={'password'}
                placeholder={t('user.edit.password_placeholder')}
                onChange={handleInputChange}
                value={password}
                autoComplete='new-password'
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('user.edit.display_name')}
                name='display_name'
                placeholder={t('user.edit.display_name_placeholder')}
                onChange={handleInputChange}
                value={display_name}
                autoComplete='new-password'
              />
            </Form.Field>
            {userId && (
              <>
                <Form.Field>
                  <Form.Input
                    label={`${t('user.edit.quota')}${renderQuotaWithPrompt(
                      quota,
                      t
                    )}`}
                    name='quota'
                    placeholder={t('user.edit.quota_placeholder')}
                    onChange={handleInputChange}
                    value={quota}
                    type={'number'}
                    autoComplete='new-password'
                  />
                </Form.Field>
                {role !== 100 && (
                  <Form.Field>
                    <Form.Select
                      label={t('user.table.role_text')}
                      name='role'
                      options={roleOptions}
                      onChange={handleInputChange}
                      value={role}
                    />
                  </Form.Field>
                )}
              </>
            )}
            <Button onClick={handleCancel}>
              {t('user.edit.buttons.cancel')}
            </Button>
            <Button positive onClick={submit}>
              {t('user.edit.buttons.submit')}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
};

export default EditUser;
