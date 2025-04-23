// // app/components/AddStockForm.test.tsx
// import React from 'react';
// import { render, screen, fireEvent, waitFor } from '@testing-library/react';
// import '@testing-library/jest-dom'; // For extra matchers like .toBeInTheDocument()
// import AddStockForm from './AddStockForm'; // Adjust path if needed
// import { generateClient } from 'aws-amplify/data'; // Import the function to mock

// // --- Mock the Amplify Client ---
// // We tell Jest that any call to generateClient should use our mock implementation
// // This mock simulates successful create/update operations by default
// const mockCreate = jest.fn().mockResolvedValue({ errors: null, data: { id: 'new-stock-id' } });
// const mockUpdate = jest.fn().mockResolvedValue({ errors: null, data: { id: 'edited-stock-id' } });

// jest.mock('aws-amplify/data', () => ({
//   generateClient: jest.fn(() => ({
//     models: {
//       PortfolioStock: {
//         create: mockCreate,
//         update: mockUpdate,
//         // Add other methods like .get() or .list() if the component uses them directly (unlikely for this form)
//       },
//     },
//   })),
// }));
// // --- End Mocking ---

// // Helper function to fill the form fields
// const fillForm = (data: {
//     symbol?: string;
//     name?: string;
//     stockType?: string;
//     region?: string;
//     pdp?: string;
//     plr?: string;
//     budget?: string;
//     swingHoldRatio?: string;
// }) => {
//     if (data.symbol !== undefined) fireEvent.change(screen.getByLabelText(/Stock Symbol/i), { target: { value: data.symbol } });
//     if (data.name !== undefined) fireEvent.change(screen.getByLabelText(/Stock Name/i), { target: { value: data.name } });
//     if (data.stockType !== undefined) fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: data.stockType } });
//     if (data.region !== undefined) fireEvent.change(screen.getByLabelText(/Region/i), { target: { value: data.region } });
//     if (data.pdp !== undefined) fireEvent.change(screen.getByLabelText(/PDP/i), { target: { value: data.pdp } });
//     if (data.plr !== undefined) fireEvent.change(screen.getByLabelText(/PLR/i), { target: { value: data.plr } });
//     if (data.budget !== undefined) fireEvent.change(screen.getByLabelText(/Annual Budget/i), { target: { value: data.budget } });
//     if (data.swingHoldRatio !== undefined) fireEvent.change(screen.getByLabelText(/SHR/i), { target: { value: data.swingHoldRatio } });
// };


// // Group tests for the component
// describe('AddStockForm', () => {
//   // Clear mocks before each test to ensure clean state
//   beforeEach(() => {
//     mockCreate.mockClear();
//     mockUpdate.mockClear();
//     // Clear any other mocks if added
//   });

//   // --- Test Case 1: Rendering in Add Mode ---
//   it('renders correctly in Add mode', () => {
//     render(<AddStockForm />);

//     // Check if key elements are present
//     expect(screen.getByRole('heading', { name: /Add New Stock/i })).toBeInTheDocument();
//     expect(screen.getByLabelText(/Stock Symbol/i)).toBeInTheDocument();
//     expect(screen.getByLabelText(/Type/i)).toBeInTheDocument();
//     expect(screen.getByLabelText(/Region/i)).toBeInTheDocument();
//     expect(screen.getByLabelText(/SHR/i)).toBeInTheDocument(); // Check new field
//     expect(screen.getByRole('button', { name: /Add Stock/i })).toBeInTheDocument();
//   });

//   // --- Test Case 2: Successful Submission in Add Mode ---
//   it('submits correct data and calls callback in Add mode', async () => {
//     const handleStockAdded = jest.fn(); // Mock callback prop
//     render(<AddStockForm onStockAdded={handleStockAdded} />);

//     // Fill the form with valid data
//     fillForm({
//         symbol: 'TEST',
//         name: 'Test Stock Inc.',
//         stockType: 'ETF',
//         region: 'EU',
//         pdp: '5',
//         plr: '2.5',
//         budget: '1000',
//         swingHoldRatio: '60'
//     });

//     // Click the submit button
//     fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));

//     // Wait for the async operations (mocked client call) to complete
//     // and check if the create function was called with the correct payload
//     await waitFor(() => {
//       expect(mockCreate).toHaveBeenCalledTimes(1);
//       expect(mockCreate).toHaveBeenCalledWith({
//         symbol: 'TEST', // Uppercased
//         stockType: 'ETF',
//         region: 'EU',
//         name: 'Test Stock Inc.',
//         pdp: 5.0, // Parsed to float
//         plr: 2.5, // Parsed to float
//         budget: 1000.0, // Parsed to float
//         swingHoldRatio: 60.0, // Parsed to float
//         // isHidden should default based on schema, not included unless explicitly set
//       });
//     });

//     // Check if the success callback was called
//     expect(handleStockAdded).toHaveBeenCalledTimes(1);
//   });

//   // --- Test Case 3: Rendering in Edit Mode ---
//   it('renders correctly and populates fields in Edit mode', () => {
//     const initialStockData = {
//       id: 'stock-123',
//       symbol: 'EDIT',
//       name: 'Edit Me',
//       stockType: 'Crypto',
//       region: 'APAC',
//       pdp: 10,
//       plr: 3,
//       budget: 500,
//       swingHoldRatio: 75,
//       isHidden: false,
//       createdAt: '', // Add required fields even if not displayed
//       updatedAt: '', // Add required fields even if not displayed
//     };

//     render(<AddStockForm isEditMode={true} initialData={initialStockData} />);

//     // Check heading and button text
//     expect(screen.getByRole('heading', { name: /Edit EDIT/i })).toBeInTheDocument();
//     expect(screen.getByRole('button', { name: /Update Stock/i })).toBeInTheDocument();

//     // Check if fields are populated correctly (use `toHaveValue`)
//     expect(screen.getByLabelText(/Stock Symbol/i)).toHaveValue('EDIT');
//     expect(screen.getByLabelText(/Stock Name/i)).toHaveValue('Edit Me');
//     expect(screen.getByLabelText(/Type/i)).toHaveValue('Crypto');
//     expect(screen.getByLabelText(/Region/i)).toHaveValue('APAC');
//     expect(screen.getByLabelText(/PDP/i)).toHaveValue(10); // Number input value
//     expect(screen.getByLabelText(/PLR/i)).toHaveValue(3);
//     expect(screen.getByLabelText(/Annual Budget/i)).toHaveValue(500);
//     expect(screen.getByLabelText(/SHR/i)).toHaveValue(75);
//   });

//    // --- Test Case 4: Successful Submission in Edit Mode ---
//    it('submits correct data and calls callback in Edit mode', async () => {
//     const handleUpdate = jest.fn(); // Mock callback prop
//     const initialStockData = {
//       id: 'stock-123',
//       symbol: 'EDIT',
//       name: 'Edit Me',
//       stockType: 'Crypto',
//       region: 'APAC',
//       pdp: 10,
//       plr: 3,
//       budget: 500,
//       swingHoldRatio: 75,
//       isHidden: false,
//       createdAt: '',
//       updatedAt: '',
//     };

//     render(
//       <AddStockForm
//         isEditMode={true}
//         initialData={initialStockData}
//         onUpdate={handleUpdate}
//       />
//     );

//     // Change some fields
//     fillForm({
//         name: 'Edited Name!',
//         pdp: '12.5',
//         swingHoldRatio: '50'
//     });

//     // Click the submit button
//     fireEvent.click(screen.getByRole('button', { name: /Update Stock/i }));

//     // Wait and check if the update function was called correctly
//     await waitFor(() => {
//       expect(mockUpdate).toHaveBeenCalledTimes(1);
//       expect(mockUpdate).toHaveBeenCalledWith({
//         id: 'stock-123', // Crucially includes the ID
//         symbol: 'EDIT', // Symbol isn't usually editable, remains the same
//         stockType: 'Crypto',
//         region: 'APAC',
//         name: 'Edited Name!', // Updated value
//         pdp: 12.5,         // Updated value (parsed)
//         plr: 3,            // Unchanged value (parsed)
//         budget: 500,       // Unchanged value (parsed)
//         swingHoldRatio: 50.0, // Updated value (parsed)
//       });
//     });

//     // Check if the update callback was called (it receives the same payload)
//     expect(handleUpdate).toHaveBeenCalledTimes(1);
//     expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ // Check payload structure
//         id: 'stock-123',
//         name: 'Edited Name!',
//         pdp: 12.5,
//         swingHoldRatio: 50.0,
//     }));
//   });

//   // --- Test Case 5: Validation Error ---
//   it('shows validation error if required fields are missing', async () => {
//       render(<AddStockForm />);

//       // Leave symbol empty, fill others if needed
//       fillForm({ name: 'Incomplete Stock' });

//       // Click submit
//       fireEvent.click(screen.getByRole('button', { name: /Add Stock/i }));

//       // Check if an error message appears (adjust text based on your actual error message)
//       // Use findByRole or findByText for elements that appear asynchronously
//       const errorElement = await screen.findByText(/Symbol, Type, and Region are required/i);
//       expect(errorElement).toBeInTheDocument();

//       // Ensure client methods were NOT called
//       expect(mockCreate).not.toHaveBeenCalled();
//   });

//   // --- Test Case 6: Cancel Button ---
//   it('calls onCancel prop when cancel button is clicked', () => {
//       const handleCancel = jest.fn();
//       const initialStockData = { id: 'stock-123', symbol: 'EDIT', /* ... other fields */ };
//       render(
//           <AddStockForm
//               isEditMode={true}
//               initialData={initialStockData}
//               onCancel={handleCancel}
//           />
//       );

//       // Click the cancel button
//       fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

//       // Check if the cancel callback was called
//       expect(handleCancel).toHaveBeenCalledTimes(1);
//   });

//   // TODO: Add more tests:
//   // - Validation for SHR < 0 or > 100
//   // - Handling API errors (mocking create/update to reject)
//   // - Edge cases (empty strings for optional fields, zero values)

// });
