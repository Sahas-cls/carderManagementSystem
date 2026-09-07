'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Starter master data so the Resigned Employee popup's dropdowns aren't
  // empty - there's no admin screen to manage these yet (unlike Resignation
  // Reasons), so seed a reasonable default list. Add/rename rows directly in
  // the designations/departments/sections tables until a management UI exists.
  async up(queryInterface) {
    const now = new Date();

    const designations = [
      'Machine Operator',
      'Trainee Machine Operator',
      'Line Leader',
      'Supervisor',
      'Quality Checker',
      'Mechanic',
    ];
    await queryInterface.bulkInsert(
      'designations',
      designations.map((designation) => ({ designation, createdAt: now, updatedAt: now })),
    );

    const sections = ['Section A', 'Section B', 'Section C', 'Section D'];
    await queryInterface.bulkInsert(
      'sections',
      sections.map((sectionName) => ({ sectionName, createdAt: now, updatedAt: now })),
    );

    const [factories] = await queryInterface.sequelize.query(
      'SELECT id FROM factories WHERE deletedAt IS NULL',
    );
    const departmentNames = ['Cutting', 'Sewing', 'Finishing', 'Quality Assurance', 'Store'];
    const departmentRows = factories.flatMap((factory) =>
      departmentNames.map((departmentName) => ({
        factoryId: factory.id,
        departmentName,
        createdAt: now,
        updatedAt: now,
      })),
    );
    if (departmentRows.length) {
      await queryInterface.bulkInsert('departments', departmentRows);
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('designations', null, {});
    await queryInterface.bulkDelete('sections', null, {});
    await queryInterface.bulkDelete('departments', null, {});
  },
};
