import { randomUUID } from 'crypto';

const TEST_PASSWORD = 'TestUser@1234';

export interface Address {
    street: string;
    city: string;
    state: string;
    zipCode: string;
}

export interface Customer {
    firstName: string;
    lastName: string;
    address: Address;
    phoneNumber: string;
    ssn: string;
    username: string;
    password: string;
}

export function createUniqueCustomer(): Customer {
    const uniqueId = randomUUID().replace(/-/g, '').slice(0, 12);

    return {
        firstName: 'Test',
        lastName: 'Customer',
        address: {
            street: '10 Test Street',
            city: 'Test City',
            state: 'Test State',
            zipCode: '1002',
        },
        username: `cust_${uniqueId}`,
        phoneNumber: '5551234567',
        ssn: '123456789',
        password: TEST_PASSWORD
    };
}

