import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Card } from 'semantic-ui-react';
import { useParams, useNavigate } from 'react-router-dom';
import { API, downloadTextAsFile, showError, showSuccess } from '../../helpers';
import { renderQuotaWithPrompt } from '../../helpers/render';

const EditRedemption = () => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const redemptionId = params.id;
  const isEdit = redemptionId !== undefined;
  const [loading, setLoading] = useState(isEdit);
  const originInputs = {
    quota: 100000,
  };
  const [inputs, setInputs] = useState(originInputs);
  const { quota } = inputs;

  const handleCancel = () => {
    navigate('/redemption');
  };

  const handleInputChange = (e, { name, value }) => {
    setInputs((inputs) => ({ ...inputs, [name]: value }));
  };

  const loadRedemption = async () => {
    let res = await API.get(`/api/redemption/${redemptionId}`);
    const { success, message, data } = res.data;
    if (success) {
      setInputs(data);
    } else {
      showError(message);
    }
    setLoading(false);
  };
  useEffect(() => {
    if (isEdit) {
      loadRedemption().then();
    }
  }, []);

  const submit = async () => {
    const localInputs = {
      quota: parseInt(inputs.quota),
      count: 1,
    };
    let res;
    if (isEdit) {
      res = await API.put(`/api/redemption/`, {
        quota: localInputs.quota,
        id: parseInt(redemptionId),
      });
    } else {
      res = await API.post(`/api/redemption/`, {
        ...localInputs,
      });
    }
    const { success, message, data } = res.data;
    if (!success) {
      showError(message);
      return;
    }

    if (!isEdit && Array.isArray(data) && data.length > 0) {
      const text = `${data.join('\n')}\n`;
      downloadTextAsFile(text, `redemption-code-${Date.now()}.txt`);
    }

    showSuccess(
      isEdit
        ? t('redemption.messages.update_success')
        : t('redemption.messages.create_success')
    );
    // Replace the creation/edit route so browser Back does not reopen the
    // submitted form and accidentally create the same quota code again.
    navigate('/redemption', { replace: true });
  };

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>
            {isEdit ? t('redemption.edit.title_edit') : t('redemption.edit.title_create')}
          </Card.Header>
          <Form className='page-form' loading={loading} autoComplete='new-password'>
            <Form.Field>
              <Form.Input
                label={`${t('redemption.edit.quota')}${renderQuotaWithPrompt(quota, t)}`}
                name='quota'
                placeholder={t('redemption.edit.quota_placeholder')}
                onChange={handleInputChange}
                value={quota}
                autoComplete='new-password'
                type='number'
              />
            </Form.Field>
            <Button positive onClick={submit}>
              {t('redemption.edit.buttons.submit')}
            </Button>
            <Button onClick={handleCancel}>
              {t('redemption.edit.buttons.cancel')}
            </Button>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
};

export default EditRedemption;
