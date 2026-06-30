import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import qrcode from 'qrcode-terminal';
import { TelegramClient } from 'gramjs';
import { StringSession } from 'gramjs/sessions/index.js';

const rl = readline.createInterface({ input, output });

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function toLoginUrl(token) {
  return `tg://login?token=${token.toString('base64url')}`;
}

async function chooseLoginMode() {
  const answer = await rl.question('Login by QR? [Y/n]: ');
  return answer.trim().toLowerCase() !== 'n' ? 'qr' : 'code';
}

async function shouldForceSms() {
  const answer = await rl.question('Force SMS code? [y/N]: ');
  return answer.trim().toLowerCase() === 'y';
}

const client = new TelegramClient(
  new StringSession(''),
  Number(getRequiredEnv('TG_API_ID')),
  getRequiredEnv('TG_API_HASH'),
  { connectionRetries: 5 },
);

const loginMode = await chooseLoginMode();
const forceSMS = loginMode === 'code' ? await shouldForceSms() : false;

await client.start({
  phoneNumber: async () => {
    if (loginMode === 'qr') {
      const error = new Error('Restart auth with QR');
      error.errorMessage = 'RESTART_AUTH_WITH_QR';
      throw error;
    }

    return rl.question('Phone number: ');
  },
  password: async () => rl.question('2FA password, if enabled: '),
  phoneCode: async (isCodeViaApp) => {
    const destination = isCodeViaApp ? 'Telegram app' : 'SMS/phone';
    return rl.question(`Telegram code from ${destination}: `);
  },
  qrCode: async ({ token, expires }) => {
    const loginUrl = toLoginUrl(token);

    console.log('\nScan this QR in Telegram: Settings > Devices > Link Desktop Device');
    console.log(`Expires at: ${new Date(expires * 1000).toISOString()}`);
    qrcode.generate(loginUrl, { small: true });
    console.log(loginUrl);
  },
  forceSMS,
  onError: (error) => console.error(error),
});

console.log('\nTG_SESSION=');
console.log(client.session.save());

await client.disconnect();
rl.close();
