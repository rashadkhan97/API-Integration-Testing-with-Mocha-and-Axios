try {
  process.loadEnvFile();
} catch {
  // .env optional if vars are already set in the environment
}

import { expect } from 'chai';
import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const PARTNER_KEY = process.env.PARTNER_KEY || 'ROADTOSDET';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-AUTH-SECRET-KEY': PARTNER_KEY,
    'Content-Type': 'application/json',
  },
  validateStatus: () => true,
});

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function randomDigits(min, max) {
  return Math.floor(min + Math.random() * (max - min));
}

function makeUser(namePrefix, emailTag, phonePrefix) {
  return {
    name: namePrefix,
    email: `mdroshungpt+${emailTag}${randomDigits(1000, 9999)}@gmail.com`,
    phone: `${phonePrefix}${randomDigits(1000000, 9999999)}`,
  };
}

describe('dMoney API Integration Flow', function () {
  this.timeout(20000);

  let adminToken, systemToken, agentToken, customer01Token, customer02Token;

  const customer01 = makeUser('Customer01', '', '0120');
  const customer02 = makeUser('Customer02', '', '0121');
  const agent = makeUser('Agent01', 'agent+', '0140');
  const merchant = makeUser('Merchant01', 'merchant+', '0130');

  async function createUser(user, role) {
    const res = await api.post(
      '/user/create',
      {
        name: user.name,
        email: user.email,
        password: '1234',
        phone_number: user.phone,
        nid: '01234567',
        role,
      },
      authHeader(adminToken)
    );
    expect(res.status).to.equal(201);
    expect(res.data.message).to.include('User created');
    user.id = res.data.user.id;
  }

  async function activateUser(user) {
    const res = await api.patch(
      `/user/update/${user.id}`,
      { status: 'active' },
      authHeader(adminToken)
    );
    expect(res.status).to.equal(200);
    expect(res.data.message).to.include('User updated successfully');
  }

  describe('Admin Login', () => {
    it('logs in admin with valid credentials (200)', async () => {
      const res = await api.post('/user/login', {
        email: 'admin@dmoney.com',
        password: '1234',
      });
      expect(res.status).to.equal(200);
      expect(res.data.message).to.include('Login successful');
      adminToken = res.data.token;
    });
  });

  describe('Create and Activate Customer, Agent, Merchant', () => {
    it('creates customer 01 (201)', async () => createUser(customer01, 'Customer'));
    it('activates customer 01 (200)', async () => activateUser(customer01));

    it('creates customer 02 (201)', async () => createUser(customer02, 'Customer'));
    it('activates customer 02 (200)', async () => activateUser(customer02));

    it('creates agent (201)', async () => createUser(agent, 'Agent'));
    it('activates agent (200)', async () => activateUser(agent));

    it('creates merchant (201)', async () => createUser(merchant, 'Merchant'));
    it('activates merchant (200)', async () => activateUser(merchant));
  });

  describe('System Login and Deposit to Agent', () => {
    it('logs in system with valid credentials (200)', async () => {
      const res = await api.post('/user/login', {
        email: 'system@dmoney.com',
        password: '1234',
      });
      expect(res.status).to.equal(200);
      expect(res.data.message).to.include('Login successful');
      systemToken = res.data.token;
    });

    it('deposits 5000 tk from SYSTEM to agent account (201)', async () => {
      const res = await api.post(
        '/transaction/deposit',
        { from_account: 'SYSTEM', to_account: agent.phone, amount: 5000 },
        authHeader(systemToken)
      );
      expect(res.status).to.equal(201);
      expect(res.data.message).to.include('SYSTEM deposit to Agent successful');
    });
  });

  describe('Agent Login and Deposit to Customer 01', () => {
    it('logs in agent and sends OTP (200)', async () => {
      const res = await api.post('/user/login', {
        email: agent.email,
        password: '1234',
      });
      expect(res.status).to.equal(200);
      expect(res.data.message.toLowerCase()).to.include('otp');
    });

    it('verifies agent OTP (200)', async () => {
      const res = await api.post('/user/verify-otp?env=dev', {
        identifier: agent.email,
        otp: '0000',
      });
      expect(res.status).to.equal(200);
      agentToken = res.data.token;
    });

    it('agent deposits 2000 tk to customer 01 and commission is 2.5% (201)', async () => {
      const amount = 2000;
      const res = await api.post(
        '/transaction/deposit',
        { from_account: agent.phone, to_account: customer01.phone, amount },
        authHeader(agentToken)
      );
      expect(res.status).to.equal(201);
      expect(res.data.message).to.include('Deposit successful');
      expect(res.data.commission).to.equal(amount * 0.025);
    });
  });

  describe('Customer 01 Login and Send Money to Customer 02', () => {
    it('logs in customer 01 and sends OTP (200)', async () => {
      const res = await api.post('/user/login', {
        email: customer01.email,
        password: '1234',
      });
      expect(res.status).to.equal(200);
      expect(res.data.message.toLowerCase()).to.include('otp');
    });

    it('verifies customer 01 OTP (200)', async () => {
      const res = await api.post('/user/verify-otp?env=dev', {
        identifier: customer01.email,
        otp: '0000',
      });
      expect(res.status).to.equal(200);
      customer01Token = res.data.token;
    });

    it('sends 1000 tk to customer 02 and service fee is flat 5 tk (201)', async () => {
      const res = await api.post(
        '/transaction/sendmoney',
        { from_account: customer01.phone, to_account: customer02.phone, amount: 1000 },
        authHeader(customer01Token)
      );
      expect(res.status).to.equal(201);
      expect(res.data.message).to.include('Send money successful');
      expect(res.data.fee).to.equal(5);
    });
  });

  describe('Customer 02 Login, Cash Out from Agent and Pay Merchant', () => {
    it('logs in customer 02 and sends OTP (200)', async () => {
      const res = await api.post('/user/login', {
        email: customer02.email,
        password: '1234',
      });
      expect(res.status).to.equal(200);
      expect(res.data.message.toLowerCase()).to.include('otp');
    });

    it('verifies customer 02 OTP (200)', async () => {
      const res = await api.post('/user/verify-otp?env=dev', {
        identifier: customer02.email,
        otp: '0000',
      });
      expect(res.status).to.equal(200);
      customer02Token = res.data.token;
    });

    it('cashes out 500 tk from agent and service fee is max(1%, 5) (201)', async () => {
      const amount = 500;
      const expectedFee = Math.max(amount * 0.01, 5);
      const res = await api.post(
        '/transaction/withdraw',
        { from_account: customer02.phone, to_account: agent.phone, amount },
        authHeader(customer02Token)
      );
      expect(res.status).to.equal(201);
      expect(res.data.message).to.equal('Withdraw successful');
      expect(res.data.fee).to.equal(expectedFee);
    });

    it('pays 400 tk to merchant and service fee is max(1%, 5) (201)', async () => {
      const amount = 400;
      const expectedFee = Math.max(amount * 0.01, 5);
      const res = await api.post(
        '/transaction/payment',
        { from_account: customer02.phone, to_account: merchant.phone, amount },
        authHeader(customer02Token)
      );
      expect(res.status).to.equal(201);
      expect(res.data.message).to.equal('Payment successful');
      expect(res.data.fee).to.equal(expectedFee);
    });
  });
});
