"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Employee extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      Employee.belongsTo(models.Designation, {
        foreignKey: "designationId",
        as: "designation",
      });
      Employee.belongsTo(models.Department, {
        foreignKey: "departmentId",
        as: "department",
      });
      Employee.belongsTo(models.Section, {
        foreignKey: "sectionId",
        as: "section",
      });
      // Only set once the employee has resigned - see dateOfResign.
      Employee.belongsTo(models.ResignationReason, {
        foreignKey: "resignationReasonId",
        as: "resignationReason",
      });
    }
  }
  Employee.init(
    {
      epf: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      employeeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      designationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "designations",
          key: "id",
        },
      },
      departmentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "departments",
          key: "id",
        },
      },
      sectionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "sections",
          key: "id",
        },
      },
      // Ties this employee to the Daily Data Entry batch that recorded their
      // resignation (see server/src/services/dailyCadreService.js - batchId
      // is a plain UUID shared across every carder table for one entry, not
      // a real FK to a single table). Null once unlinked (entry deleted, or
      // the resigned count on that entry was reduced) or for an employee
      // never tied to a daily entry.
      batchId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // true = counted against that entry's Resigned/Terminated MO count,
      // false = TMO. Null when batchId is null.
      isMo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      dateOfJoin: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      // Null while the employee is still active. Service period is derived
      // from dateOfJoin & (dateOfResign || today) in the controller, not
      // stored here.
      dateOfResign: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      resignationReasonId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "resignationreasons",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Employee",
      tableName: "employees",
      timestamps: true,
      paranoid: true,
    },
  );
  return Employee;
};
