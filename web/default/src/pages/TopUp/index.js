import React, { useEffect, useState } from 'react';
import {
  Button,
  Form,
  Header,
  Card,
  Message,
  Statistic,
} from 'semantic-ui-react';
import { API, showError, showInfo, showSuccess } from '../../helpers';
import { renderQuota } from '../../helpers/render';
import { useTranslation } from 'react-i18next';

const TopUp = () => {
  const { t } = useTranslation();
  const [redemptionCode, setRedemptionCode] = useState('');
  const [userQuota, setUserQuota] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topUp = async () => {
    if (redemptionCode === '') {
      showInfo(t('topup.redeem_code.empty_code'));
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await API.post('/api/user/topup', {
        key: redemptionCode,
      });
      const { success, message, data } = res.data;
      if (success) {
        showSuccess(t('topup.redeem_code.success'));
        setUserQuota((quota) => {
          return quota + data;
        });
        setRedemptionCode('');
      } else {
        showError(message);
      }
    } catch (err) {
      showError(t('topup.redeem_code.request_failed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserQuota = async () => {
    let res = await API.get(`/api/user/self`);
    const { success, message, data } = res.data;
    if (success) {
      setUserQuota(data.quota);
    } else {
      showError(message);
    }
  };

  useEffect(() => {
    getUserQuota().then();
  }, []);

  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header>
            <Header as='h2'>{t('topup.title')}</Header>
          </Card.Header>
          <Card.Description className='redeem-content'>
            <div className='redeem-summary'>
              <Statistic>
                <Statistic.Value style={{ color: '#2185d0' }}>
                  {renderQuota(userQuota, t)}
                </Statistic.Value>
                <Statistic.Label>
                  {t('topup.get_code.current_quota')}
                </Statistic.Label>
              </Statistic>
            </div>

            <Message className='page-notice' info content={t('topup.monthly_notice')} />

            <Form className='page-form'>
              <Form.Input
                fluid
                icon='key'
                iconPosition='left'
                placeholder={t('topup.redeem_code.placeholder')}
                value={redemptionCode}
                onChange={(e) => {
                  setRedemptionCode(e.target.value);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pastedText = e.clipboardData.getData('text');
                  setRedemptionCode(pastedText.trim());
                }}
                action={
                  <Button
                    icon='paste'
                    content={t('topup.redeem_code.paste')}
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setRedemptionCode(text.trim());
                      } catch (err) {
                        showError(t('topup.redeem_code.paste_error'));
                      }
                    }}
                  />
                }
              />
              <Button
                color='green'
                fluid
                size='large'
                onClick={topUp}
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t('topup.redeem_code.submitting')
                  : t('topup.redeem_code.submit')}
              </Button>
            </Form>
          </Card.Description>
        </Card.Content>
      </Card>
    </div>
  );
};

export default TopUp;
