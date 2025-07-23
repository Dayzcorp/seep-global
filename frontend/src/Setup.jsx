import React from 'react';
import SetupModal from './SetupModal';

export default function Setup() {
  const close = () => {
    window.location.href = '/dashboard';
  };

  return <SetupModal onClose={close} />;
}
