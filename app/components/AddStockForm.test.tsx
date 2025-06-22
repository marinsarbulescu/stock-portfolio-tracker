// app/components/AddStockForm.test.tsx
import React from 'react';
import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom'; // For extra matchers like .toBeInTheDocument()
// import AddStockForm from './AddStockForm'; // Adjust path if needed

// // --- Import Mock Functions from Manual Mock ---
// // Adjust the relative path based on your project structure
// // This assumes AddStockForm.test.tsx is in app/components/
// // @ts-ignore
// import { __testMocks as amplifyDataMocks } from 'aws-amplify/data';

// const { mockPortfolioStockCreate, mockPortfolioStockUpdate } = amplifyDataMocks;


// // --- Configure the default mock behavior ---
// // Reset mocks and set default resolved values before each test
// beforeEach(() => {
//   // We still clear/reset these in case other components use them,
//   // but AddStockForm only uses mockCreate directly.
//   mockPortfolioStockCreate.mockResolvedValue({ errors: null, data: { id: 'new-stock-id' /* Add other fields returned by create if needed */ } });
//   mockPortfolioStockUpdate.mockResolvedValue({ errors: null, data: { id: 'edited-stock-id' /* Add other fields returned by update if needed */ } });
// });


// // --- Define Type Alias for Form Data ---
// type FillFormData = {
//     symbol?: string,
//     name?: string,
//     stockType?: string,
//     region?: string,
//     pdp?: string,
//     plr?: string,
//     budget?: string,
//     swingHoldRatio?: string
// };
// // --- End Type Alias ---

// // Helper function to fill the form fields - Uses the Type Alias
// const fillForm = (data: FillFormData) => {
//     // --- Update Label Text Query ---
//     if (data.symbol !== undefined) fireEvent.change(screen.getByLabelText(/Ticker/i), { target: { value: data.symbol } });
//     // --- End Update ---
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
//   // beforeEach now resets and configures mocks
//   beforeEach(() => {
//     // Reset mocks before each test
//     mockPortfolioStockCreate?.mockClear(); // Use optional chaining ? if declared with let
//     mockPortfolioStockUpdate?.mockClear();
//     // Reset other necessary mocks
//   });

//   // --- Test Case 1: Rendering in Add Mode ---
//   it('renders correctly in Add mode', () => {
//     // Arrange & Act
//     render(<AddStockForm />);

//     // Assert - Check initial render state for Add Mode
//     expect(screen.getByRole('button', { name: /Add Stock/i })).toBeInTheDocument();
//     // Add other assertions for initial Add Mode render...
//   }); // --- END Test Case 1 ---


//   // --- Test Case 2: Submission in Add Mode ---
//   test('should call create when adding a new stock', async () => {
//       // Arrange
//       const handleStockAddedOrUpdated = jest.fn();
//       // Mock the create call to succeed - make sure the returned data includes essential fields if the callback uses them
//       mockPortfolioStockCreate.mockResolvedValue({ data: { id: 'new-stock-id', symbol: 'NEW', name: 'Test Name', stockType: 'Stock', region: 'US', owner: 'test-owner', createdAt: '...', updatedAt: '...' }, errors: null });

//       render(<AddStockForm onStockAdded={handleStockAddedOrUpdated} />);
//       const user = userEvent.setup();

//       // --- Act: Fill required fields THEN click ---
//       // Use screen.getByLabelText or similar to find form elements
//       await user.type(screen.getByLabelText(/Ticker/i), 'NEW');
//       await user.type(screen.getByLabelText(/Stock Name/i), 'Test Name'); // Add if needed
//       await user.selectOptions(screen.getByLabelText(/Type/i), 'Stock'); // Select an option
//       await user.selectOptions(screen.getByLabelText(/Region/i), 'US'); // Select an option

//       // Now click the submit button
//       await user.click(screen.getByRole('button', { name: /Add Stock/i }));
//       // --- End Act ---

//       // Assert
//       await waitFor(() => {
//           // Now this assertion should pass if form validation is met
//           expect(mockPortfolioStockCreate).toHaveBeenCalledTimes(1);
//           expect(handleStockAddedOrUpdated).toHaveBeenCalledTimes(1);
//       });

//       // This assertion should still pass
//       expect(mockPortfolioStockUpdate).not.toHaveBeenCalled();
//   }); // --- END Test Case 2 ---



//   // --- Test Case 3: Rendering in Edit Mode ---
//   it('renders correctly and populates fields in Edit mode', () => {
//     const initialStockData = { /* ... valid initial data with 'as const' ... */
//         id: 'stock-123', symbol: 'EDIT', name: 'Edit Me', stockType: 'Crypto' as const,
//         region: 'APAC' as const, pdp: 10, plr: 3, budget: 500, swingHoldRatio: 75,
//         isHidden: false, createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
//     };
//     render(<AddStockForm isEditMode={true} initialData={initialStockData} />);
//     // ... assertions ...
//     expect(screen.getByRole('heading', { name: /Edit EDIT/i })).toBeInTheDocument();
//     expect(screen.getByRole('button', { name: /Update Stock/i })).toBeInTheDocument();
//     expect(screen.getByLabelText(/Ticker/i)).toHaveValue('EDIT');
//     // ... check other fields ...
//      expect(screen.getByLabelText(/Stock Name/i)).toHaveValue('Edit Me');
//      expect(screen.getByLabelText(/Type/i)).toHaveValue('Crypto');
//      expect(screen.getByLabelText(/Region/i)).toHaveValue('APAC');
//      expect(screen.getByLabelText(/PDP/i)).toHaveValue(10);
//      expect(screen.getByLabelText(/PLR/i)).toHaveValue(3);
//      expect(screen.getByLabelText(/Annual Budget/i)).toHaveValue(500);
//      expect(screen.getByLabelText(/SHR/i)).toHaveValue(75);
//   });

  

//   // --- Test Case 4: Submission in Edit Mode ---
//   test('should call update when editing an existing stock', async () => {
//     // Arrange
//     const handleStockAddedOrUpdated = jest.fn();
//     const existingStock = { id: 'edit-stock-id', symbol: 'EDIT', name: 'Old Name', /* other fields */ };
//     // Mock the update call to succeed
//     handleStockAddedOrUpdated.mockResolvedValue(undefined);
//     mockPortfolioStockUpdate.mockResolvedValue({ data: { ...existingStock, name: 'New Name' }, errors: null });
  
//     render(
//       <AddStockForm
//           isEditMode={true}
//           initialData={existingStock}
//           onUpdate={handleStockAddedOrUpdated} // Pass the mock for onUpdate
//       />
//     );
//     const user = userEvent.setup();
  
//     // Act
//     const nameInput = screen.getByLabelText(/Name/i);
//     await user.clear(nameInput);
//     await user.type(nameInput, 'New Name');
//     await user.click(screen.getByRole('button', { name: /Update Stock/i })); // Adjust button text
  
//     // Assert
//     await waitFor(() => {
//       expect(handleStockAddedOrUpdated).toHaveBeenCalledTimes(1);
//     });
//     expect(mockPortfolioStockCreate).not.toHaveBeenCalled(); // Ensure create wasn't called
//   });


//   // --- Test Case 5: Successful Submission in Edit Mode ---
//   it('submits correct data and calls callback in Edit mode', async () => {
//     const handleUpdate = jest.fn(); // Mock the onUpdate prop
//     const initialStockData = { /* ... valid initial data with 'as const' ... */
//         id: 'stock-123', symbol: 'EDIT', name: 'Edit Me', stockType: 'Crypto' as const,
//         region: 'APAC' as const, pdp: 10, plr: 3, budget: 500, swingHoldRatio: 75,
//         isHidden: false, createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
//     };
//     render(<AddStockForm isEditMode={true} initialData={initialStockData} onUpdate={handleUpdate} />);
//     fillForm({ /* ... changes ... */ name: 'Edited Name!', pdp: '12.5', swingHoldRatio: '50' });

//     // --- Explicitly wrap the event in act ---
//     await act(async () => {
//         fireEvent.click(screen.getByRole('button', { name: /Update Stock/i }));
//         // Allow promises triggered by click to resolve
//         await Promise.resolve();
//     });
//     // --- End act wrapper ---


//     // Check if the update callback was called
//     await waitFor(() => { // Still use waitFor in case onUpdate has async effects internally
//         expect(handleUpdate).toHaveBeenCalledTimes(1);
//         expect(handleUpdate).toHaveBeenCalledWith(expect.objectContaining({ // Check payload structure passed to the prop
//             id: 'stock-123',
//             name: 'Edited Name!',
//             pdp: 12.5,
//             swingHoldRatio: 50.0,
//             // Include other expected fields from stockDataPayload
//             symbol: 'EDIT',
//             stockType: 'Crypto',
//             region: 'APAC',
//             plr: 3,
//             budget: 500,
//         }));
//     });
//   });



//   // --- Test Case 6: Cancel Button ---
//   it('calls onCancel prop when cancel button is clicked', () => {
//     const handleCancel = jest.fn();
//     const initialStockData = { /* ... minimal valid initial data ... */
//         id: 'stock-123', symbol: 'EDIT', stockType: 'Stock' as const, region: 'US' as const,
//         createdAt: '2023-01-01T10:00:00Z', updatedAt: '2023-01-01T10:00:00Z',
//     };
//     render(<AddStockForm isEditMode={true} initialData={initialStockData} onCancel={handleCancel} />);
//     // No need to await simple click events unless they trigger async actions
//     fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
//     expect(handleCancel).toHaveBeenCalledTimes(1);
//   });
// });