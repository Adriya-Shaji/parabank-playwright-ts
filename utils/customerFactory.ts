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
    const timestamp = Date.now();

    return {
        firstName: 'Test',
        lastName: 'Customer',
        address: {
            street: '10 Test Street',
            city: 'Test City',
            state: 'Test State',
            zipCode: '1002',
        },
        username: `customer_${timestamp}`,
        phoneNumber: '5551234567',
        ssn: '123456789',
        password: TEST_PASSWORD
    };
}

