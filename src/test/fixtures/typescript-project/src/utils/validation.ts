/**
 * Validation utilities for the application
 */

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export class EmailValidator {
    private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    public static validateEmail(email: string): ValidationResult {
        const errors: string[] = [];
        
        if (!email) {
            errors.push('Email is required');
        } else if (!this.EMAIL_REGEX.test(email)) {
            errors.push('Invalid email format');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    public static validateEmailDomain(email: string, allowedDomains: string[]): boolean {
        const domain = email.split('@')[1];
        return allowedDomains.includes(domain);
    }
}

export class PasswordValidator {
    private minLength: number;
    private requireUppercase: boolean;
    private requireNumbers: boolean;
    private requireSpecialChars: boolean;

    constructor(options: {
        minLength?: number;
        requireUppercase?: boolean;
        requireNumbers?: boolean;
        requireSpecialChars?: boolean;
    } = {}) {
        this.minLength = options.minLength ?? 8;
        this.requireUppercase = options.requireUppercase ?? true;
        this.requireNumbers = options.requireNumbers ?? true;
        this.requireSpecialChars = options.requireSpecialChars ?? false;
    }

    public validatePassword(password: string): ValidationResult {
        const errors: string[] = [];

        if (!password) {
            errors.push('Password is required');
            return { isValid: false, errors };
        }

        if (password.length < this.minLength) {
            errors.push(`Password must be at least ${this.minLength} characters long`);
        }

        if (this.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (this.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

export function validatePhoneNumber(phone: string): ValidationResult {
    const errors: string[] = [];
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;

    if (!phone) {
        errors.push('Phone number is required');
    } else if (!phoneRegex.test(phone)) {
        errors.push('Invalid phone number format');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

export function validateCreditCard(cardNumber: string): ValidationResult {
    const errors: string[] = [];
    
    // Remove spaces and dashes
    const cleanNumber = cardNumber.replace(/[\s\-]/g, '');
    
    if (!cleanNumber) {
        errors.push('Credit card number is required');
    } else if (!/^\d{13,19}$/.test(cleanNumber)) {
        errors.push('Credit card number must be 13-19 digits');
    } else if (!luhnCheck(cleanNumber)) {
        errors.push('Invalid credit card number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

function luhnCheck(cardNumber: string): boolean {
    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber.charAt(i), 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

// Constants
export const VALIDATION_MESSAGES = {
    REQUIRED: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_PHONE: 'Please enter a valid phone number',
    PASSWORD_TOO_SHORT: 'Password is too short',
    INVALID_CREDIT_CARD: 'Please enter a valid credit card number'
} as const;