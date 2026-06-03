import { Money } from './types';
export class Account { balance(): Money { return { amount: 0, currency: 'USD', precision: 2 }; } }
