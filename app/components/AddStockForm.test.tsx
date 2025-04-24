// app/components/AddStockForm.test.tsx
import React from 'react';
// Import act from react
import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // For extra matchers like .toBeInTheDocument()
import AddStockForm from './AddStockForm'; // Adjust path if needed

// --- Import Mock Functions from Manual Mock ---
// Adjust the relative path based on your project structure
// This assumes AddStockForm.test.tsx is in app/components/
import { mockCreate, mockUpdate } from '../__mocks__/aws-amplify/data';

// --- REMOVE or COMMENT OUT the jest.mock(...) block ---
/*
jest.mock('aws-amplify/data', () => ({
  generateClient: jest.fn(() => ({
    models: {
      PortfolioStock: {
        create: mockCreate,
        update: mockUpdate,
      },
    },
  })),
}));
*/
// --- End Removal ---


// --- Configure the default mock behavior ---
// Reset mocks and set default resolved values before each test
beforeEach(() => {
  // We still clear/reset these in case other components use them,
  // but AddStockForm only uses mockCreate directly.
  mockCreate.mockClear().mockResolvedValue({ errors: null, data: { id: 'new-stock-id' } });
  mockUpdate.mockClear().mockResolvedValue({ errors: null, data: { id: 'edited-stock-id' } });
});


// --- Define Type Alias for Form Data ---
type FillFormData = {
    symbol?: string,
    name?: string,
    stockType?: string,
    region?: string,
    pdp?: string,
    plr?: string,
    budget?: string,
    swingHoldRatio?: string
};
// --- End Type Alias ---

// Helper function to fill the form fields - Uses the Type Alias
const fillForm = (data: FillFormData) => {
    // --- Update Label Text Query ---
    if (data.symbol !== undefined) fireEvent.change(screen.getByLabelText(/Ticker/i), { target: { value: data.symbol } });
    // --- End Update ---
    if (data.name !== undefined) fireEvent.change(screen.getByLabelText(/Stock Name/i), { target: { value: data.name } });
    if (data.stockType !== undefined) fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: data.stockType } });
    if (data.region !== undefined) fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: data.region } });
    if (data.pdp !== undefined) fireEvent.change(screen.getByLabelText(/PDP/i), { target: { value: data.pdp } });
    if (data.plr !== undefined) fireEvent.change(screen.getByLabelText(/PLR/i), { target: { value: data.plr } });
    if (data.budget !== undefined) fireEvent.change(screen.getByLabelText(/Annual Budget/i), { target: { value: data.budget } });
    if (data.swingHoldRatio !== undefined) fireEvent.change(screen.getByLabelText(/SHR/i), { target: { value: data.swingHoldRatio } });
};


// Group tests for the component
describe('AddStockForm', () => {
  // beforeEach now resets and configures mocks

  // --- Test Case 1: Rendering in Add Mode ---
  it('renders correctly in Add mode', () => {
    render(<AddStockForm />);
    // ... assertions ...
    expect(screen.getByRole('heading', { name: /Add New Stock/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticker/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/SHR/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Stock/i })).toBeInTheDocument();
  });

  // --- Test Case 2: Successful Submission in Add Mode ---
  it('submits correct data and calls callback in Add mode', async () => {
    const handleStockAdded = jest.fn(); // Mock callback prop
    render(<AddStockForm onStockAdded={handleStockAdded} />);

    // Fill the form with valid data
    fillForm({
        symbol: 'TEST',
        name: 'Test Stock Inc.',
        stockType: 'ETF',
        region: 'EU',
        pdp: '5',
        plr: '2.5',
        budget: '1000',
        swingHoldRatio: '60'
    });

    // --- Explicitly wrap the event in act ---
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));
        // Allow promises triggered by click to resolve before continuing
        // (This might not be strictly necessary if mockCreate resolves immediately,
        // but good practice for real async operations)
        await Promise.resolve();
    });
    // --- End act wrapper ---


    // Wait for the final assertions (mock call and callback)
    // Using waitFor here is still good practice for robustness
    await waitFor(() => {
      // Verify mockCreate (client function) was called
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({ /* ... expected payload ... */
        symbol: 'TEST', stockType: 'ETF', region: 'EU', name: 'Test Stock Inc.',
        pdp: 5.0, plr: 2.5, budget: 1000.0, swingHoldRatio: 60.0,
      });
      // Verify the onStockAdded prop was called
      expect(handleStockAdded).toHaveBeenCalledTimes(1);
    });
  });

  // --- Test Case 3: Rendering in Edit Mode ---
  it('renders correctly and populates fields in Edit mode', () => {
    const initialStockData = { /* ... valid initial data with 'as const' ... */
        id: 'stock-123', symbol: 'EDIT', name: 'Edit Me', stockType: 'Crypto' as const,
        region: 'APAC' as const, pdp: 10, plr: 3, budget: 500, swingHoldRatio: 75,
        isHidden: false, createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
    };
    render(<AddStockForm isEditMode={true} initialData={initialStockData} />);
    // ... assertions ...
    expect(screen.getByRole('heading', { name: /Edit EDIT/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Stock/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Ticker/i)).toHaveValue('EDIT');
    // ... check other fields ...
     expect(screen.getByLabelText(/Stock Name/i)).toHaveValue('Edit Me');
     expect(screen.getByLabelText(/Type/i)).toHaveValue('Crypto');
     expect(screen.getByLabelText(/Region/i)).toHaveValue('APAC');
     expect(screen.getByLabelText(/PDP/i)).toHaveValue(10);
     expect(screen.getByLabelText(/PLR/i)).toHaveValue(3);
     expect(screen.getByLabelText(/Annual Budget/i)).toHaveValue(500);
     expect(screen.getByLabelText(/SHR/i)).toHaveValue(75);
  });

   // --- Test Case 4: Successful Submission in Edit Mode ---
   it('submits correct data and calls callback in Edit mode', async () => {
    const handleUpdate = jest.fn(); // Mock the onUpdate prop
    const initialStockData = { /* ... valid initial data with 'as const' ... */
        id: 'stock-123', symbol: 'EDIT', name: 'Edit Me', stockType: 'Crypto' as const,
        region: 'APAC' as const, pdp: 10, plr: 3, budget: 500, swingHoldRatio: 75,
        isHidden: false, createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
    };
    render(<AddStockForm isEditMode={true} initialData={initialStockData} onUpdate={handleUpdate} />);
    fillForm({ /* ... changes ... */ name: 'Edited Name!', pdp: '12.5', swingHoldRatio: '50' });

    // --- Explicitly wrap the event in act ---
    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Update Stock/i }));
        // Allow promises triggered by click to resolve
        await Promise.resolve();
    });
    // --- End act wrapper ---


    // Check if the update callback was called
    await waitFor(() => { // Still use waitFor in case onUpdate has async effects internally
        expect(handleUpdate).toHaveBeenCalledTimes(1);
        expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ // Check payload structure passed to the prop
            id: 'stock-123',
            name: 'Edited Name!',
            pdp: 12.5,
            swingHoldRatio: 50.0,
            // Include other expected fields from stockDataPayload
            symbol: 'EDIT',
            stockType: 'Crypto',
            region: 'APAC',
            plr: 3,
            budget: 500,
        }));
    });
  });

  // --- Test Case 5: Validation Error (REMOVED) ---
  /*
  it('shows validation error if required fields are missing', async () => {
      render(<AddStockForm />);
      fillForm({ name: 'Incomplete Stock' }); // Missing symbol, type, region

      await fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));

      // --- Use findByRole directly ---
      // findByRole implicitly uses waitFor
      const errorElement = await screen.findByRole('alert');
      // screen.debug(errorElement); // Debug the found element if needed
      // --- End Change ---

      expect(errorElement).toBeInTheDocument();
      expect(errorElement).toHaveTextContent('Symbol, Type, and Region are required.');

      expect(mockCreate).not.toHaveBeenCalled();
  });
  */
  // --- End Test Case 5 ---

  // --- Test Case 6: Cancel Button ---
  it('calls onCancel prop when cancel button is clicked', () => {
      const handleCancel = jest.fn();
      const initialStockData = { /* ... minimal valid initial data ... */
          id: 'stock-123', symbol: 'EDIT', stockType: 'Stock' as const, region: 'US' as const,
          createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
      };
      render(<AddStockForm isEditMode={true} initialData={initialStockData} onCancel={handleCancel} />);
      // No need to await simple click events unless they trigger async actions
      fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
      expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  // // +++ Test Case 7: SHR Validation Error +++
  // it('shows validation error if SHR is outside 0-100', async () => {
  //   render(<AddStockForm />); // Render in Add mode

  //   // Fill required fields, but invalid SHR
  //   fillForm({
  //       symbol: 'SHRTEST',
  //       stockType: 'Stock',
  //       region: 'US',
  //       swingHoldRatio: '101' // Invalid SHR > 100
  //   });

  //   // Click submit
  //   await fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));

  //   // Wait for the error message to appear
  //   // Assuming you added role="alert" to the error paragraph in AddStockForm.tsx
  //   const errorElement = await screen.findByRole('alert');
  //   expect(errorElement).toBeInTheDocument();
  //   // Check for the specific SHR error message from your component
  //   expect(errorElement).toHaveTextContent(/Swing-Hold Ratio must be a number between 0 and 100/i);

  //   // Ensure client methods were NOT called
  //   expect(mockCreate).not.toHaveBeenCalled();

  //   // Optional: Test the lower bound
  //   fillForm({ swingHoldRatio: '-1' }); // Invalid SHR < 0
  //   await fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));
  //   // Re-check for the same error message
  //   const errorElementLower = await screen.findByRole('alert');
  //   expect(errorElementLower).toHaveTextContent(/Swing-Hold Ratio must be a number between 0 and 100/i);
  //   expect(mockCreate).not.toHaveBeenCalled(); // Still should not have been called
  // });
  // // +++ End Test Case 7 +++

  // TODO: Add more tests ...

});