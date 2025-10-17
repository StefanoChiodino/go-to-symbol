/**
 * Main TypeScript module for testing symbol search
 */

export interface UserAccount {
    id: string;
    username: string;
    email: string;
    createdAt: Date;
    isActive: boolean;
}

export interface AccountInvoice {
    invoiceId: string;
    userId: string;
    amount: number;
    currency: string;
    dueDate: Date;
    isPaid: boolean;
}

export class UserAccountManager {
    private accounts: Map<string, UserAccount> = new Map();
    private readonly maxAccounts: number = 1000;

    constructor(maxAccounts?: number) {
        if (maxAccounts) {
            this.maxAccounts = maxAccounts;
        }
    }

    public createAccount(username: string, email: string): UserAccount {
        const account: UserAccount = {
            id: this.generateId(),
            username,
            email,
            createdAt: new Date(),
            isActive: true
        };
        
        this.accounts.set(account.id, account);
        return account;
    }

    public getAccount(id: string): UserAccount | undefined {
        return this.accounts.get(id);
    }

    public deactivateAccount(id: string): boolean {
        const account = this.accounts.get(id);
        if (account) {
            account.isActive = false;
            return true;
        }
        return false;
    }

    private generateId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    public get accountCount(): number {
        return this.accounts.size;
    }
}

export class InvoiceProcessor {
    private invoices: AccountInvoice[] = [];

    public processInvoice(invoice: AccountInvoice): void {
        this.validateInvoice(invoice);
        this.invoices.push(invoice);
    }

    public getInvoicesByUser(userId: string): AccountInvoice[] {
        return this.invoices.filter(inv => inv.userId === userId);
    }

    public calculateTotalAmount(userId: string): number {
        return this.getInvoicesByUser(userId)
            .reduce((total, invoice) => total + invoice.amount, 0);
    }

    private validateInvoice(invoice: AccountInvoice): void {
        if (!invoice.invoiceId || !invoice.userId) {
            throw new Error('Invalid invoice: missing required fields');
        }
        if (invoice.amount <= 0) {
            throw new Error('Invalid invoice: amount must be positive');
        }
    }
}

export async function fetchUserData(userId: string): Promise<UserAccount | null> {
    // Simulate API call
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                id: userId,
                username: 'testuser',
                email: 'test@example.com',
                createdAt: new Date(),
                isActive: true
            });
        }, 100);
    });
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

// Constants
export const MAX_RETRY_ATTEMPTS = 3;
export const DEFAULT_TIMEOUT_MS = 5000;
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY'] as const;

// Type aliases
export type Currency = typeof SUPPORTED_CURRENCIES[number];
export type AccountStatus = 'active' | 'inactive' | 'suspended';