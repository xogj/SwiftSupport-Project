// Local-dev default — CDK overwrites this file with real values on deploy.
// An empty apiBaseUrl keeps the SPA in mock-data mode.
// mockAuth: true exposes a fake sign-in flow so you can preview the
// authenticated UI without standing up Cognito.
window.SWIFTSUPPORT_CONFIG = {
  apiBaseUrl: '',
  mockAuth: true,
  mockUser: {
    email: 'demo@swiftsupport.com',
    name: 'Demo User',
    sub: 'mock-user-0001'
  },
  cognito: {
    domain: '',
    clientId: '',
    region: '',
    redirectUri: ''
  }
};
