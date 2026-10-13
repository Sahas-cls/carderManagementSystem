"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  // One exit event (resignation/termination or transfer) for an employee.
  // Unlike Employee.batchId/dateOfResign (a single latest-exit slot), an
  // employee can have many of these - see migration
  // 20261013000000-create-employee-exits.js.
  class EmployeeExit extends Model {
    static associate(models) {
      EmployeeExit.belongsTo(models.Employee, {
        foreignKey: "employeeId",
        as: "employee",
      });
      EmployeeExit.belongsTo(models.ResignationReason, {
        foreignKey: "resignationReasonId",
        as: "resignationReason",
      });
      EmployeeExit.belongsTo(models.Designation, {
        foreignKey: "newDesignationId",
        as: "newDesignation",
      });
    }
  }
  EmployeeExit.init(
    {
      employeeId: { type: DataTypes.INTEGER, allowNull: false },
      batchId: { type: DataTypes.UUID, allowNull: true },
      type: { type: DataTypes.ENUM("resign", "transfer"), allowNull: false },
      isMo: { type: DataTypes.BOOLEAN, allowNull: true },
      dateOfExit: { type: DataTypes.DATEONLY, allowNull: false },
      resignationReasonId: { type: DataTypes.INTEGER, allowNull: true },
      newDesignationId: { type: DataTypes.INTEGER, allowNull: true },
      promotedToMo: { type: DataTypes.BOOLEAN, allowNull: true },
      dateOfRejoin: { type: DataTypes.DATEONLY, allowNull: true },
      rejoinedBatchId: { type: DataTypes.UUID, allowNull: true },
      rejoinedIsMo: { type: DataTypes.BOOLEAN, allowNull: true },
      needsReview: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: "EmployeeExit",
      tableName: "employeeexits",
      timestamps: true,
    },
  );
  return EmployeeExit;
};
