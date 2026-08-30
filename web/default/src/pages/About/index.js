import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Icon, Label } from 'semantic-ui-react';

const About = () => {
  const { t } = useTranslation();
  return (
    <div className='dashboard-container'>
      <Card fluid className='chart-card'>
        <Card.Content className='page-card-content'>
          <Card.Header className='header'>{t('about.title')}</Card.Header>
          <div style={{ fontSize: '16px', lineHeight: 1.8 }}>
            <p>{t('about.description')}</p>
            <Label color='blue' size='large'>
              <Icon name='microchip' />
              DeepSeek V4 Flash
            </Label>
            <p className='about-description'>
              {t('about.api_description')}
            </p>
            <p className='about-description'>
              {t('about.based_on')}{' '}
              <a
                href='https://github.com/songquanpeng/one-api'
                target='_blank'
                rel='noreferrer'
              >
                One API
              </a>
            </p>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
};

export default About;
