// TEMPORARY: lets the "User" role open Manage Employees, see every employee
// and edit existing ones (never add/delete), so they can fill in the Date of
// Birth / Civil Status / Gender data missing on older records. Set to false
// once that data is complete - together with ALLOW_USER_EMPLOYEE_EDITING in
// server/src/routes/employeeRoutes.js, which is what actually enforces it
// (this flag only shows/hides the UI).
export const ALLOW_USER_EMPLOYEE_EDITING = true;
