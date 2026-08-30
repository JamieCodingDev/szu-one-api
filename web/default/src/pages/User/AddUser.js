import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Card } from 'semantic-ui-react';
import { API, isRoot, showError, showSuccess } from '../../helpers';

const AddUser = () => {
  const { t } = useTranslation();
  const originInputs = {
    username: '',
    display_name: '',
    password: '',
    role: 1,
  };
  const [inputs, setInputs] = useState(originInputs);
  const { username, display_name, password, role } = inputs;
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

  const submit = async () => {
    if (inputs.username === '' || inputs.password === '') return;
    const res = await API.post(`/api/user/`, inputs);
    const { success, message } = res.data;
    if (success) {
      showSuccess(t('user.messages.create_success'));
      setInputs(originInputs);
    } else {
      showError(message);
    }
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('user.add.title')}</Card.Header>
          <Form className='page-form' autoComplete='off'>
            <Form.Field>
              <Form.Input
                label={t('user.edit.username')}
                name='username'
                placeholder={t('user.edit.username_placeholder')}
                onChange={handleInputChange}
                value={username}
                autoComplete='off'
                required
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('user.edit.display_name')}
                name='display_name'
                placeholder={t('user.edit.display_name_placeholder')}
                onChange={handleInputChange}
                value={display_name}
                autoComplete='off'
              />
            </Form.Field>
            <Form.Field>
              <Form.Input
                label={t('user.edit.password')}
                name='password'
                type='password'
                placeholder={t('user.edit.password_placeholder')}
                onChange={handleInputChange}
                value={password}
                autoComplete='off'
                required
              />
            </Form.Field>
            <Form.Field>
              <Form.Select
                label={t('user.table.role_text')}
                name='role'
                options={roleOptions}
                onChange={handleInputChange}
                value={role}
                required
              />
            </Form.Field>
            <Button positive type='submit' onClick={submit}>
              {t('user.edit.buttons.submit')}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
};

export default AddUser;
