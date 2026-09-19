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
      // Only set for a Transfer-tile row (isTransfer: true) - see
      // newDesignationId below.
      Employee.belongsTo(models.Designation, {
        foreignKey: "newDesignationId",
        as: "newDesignation",
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
      // false = a true resignation/termination (Resigned/Terminated tile),
      // true = a Transfer-tile row - see promotedToMo below for how that
      // actually plays out. Null when batchId is null. Splits what used to
      // be one combined "Resigned/Terminated" bucket into two, while still
      // sharing this same Employee row/fields (dateOfJoin, dateOfResign,
      // reason...).
      isTransfer: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      // Only meaningful for a Transfer-tile row that was originally TMO
      // (isTransfer: true, isMo: false):
      //   - true:  an internal promotion - stays in this carder, reclassified
      //     TMO -> MO (Allocated_Current MO +1, TMO -1).
      //   - false (or ignored on an originally-MO transfer row): leaves this
      //     carder entirely, e.g. transferred to another factory/department
      //     (Allocated_Current -1 for their own type).
      // Null otherwise.
      promotedToMo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      // Only meaningful for a Transfer-tile row (isTransfer: true) - the
      // designation they're moving into (e.g. TMO -> MO on an internal
      // promotion). designationId keeps meaning their designation before
      // the transfer, same as every other exit-tile row. Null otherwise.
      newDesignationId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "designations",
          key: "id",
        },
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
      // Set when this employee is reactivated via the Resigned/Terminated
      // tile's Rejoin button (see dailyCadreService.rejoinResignedEmployee) -
      // the date the admin picked, not necessarily today or the date of the
      // daily entry that gets the Rejoined count. Overwritten on each
      // rejoin, same as dateOfResign is on each resignation; null for an
      // employee who has never rejoined, or one reactivated from the
      // Transfer tile (which doesn't ask for a date).
      dateOfRejoin: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      // Ties this employee to the Daily Data Entry batch that actually got
      // credited for their rejoin (the "view rejoined employees" eye icon
      // reads this - see dailyCadreService.listRejoinedByBatchIds) - not
      // necessarily the batch they resigned from (see rejoinResignedEmployee:
      // the admin can pick a different, later Rejoined Date). Cleared back
      // to null if they resign/transfer again (syncResignedEmployees) or if
      // that batch itself is deleted (unlinkBatch).
      rejoinedBatchId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      // true = counted against rejoinedBatchId's Rejoined MO, false = TMO.
      // Null when rejoinedBatchId is null. Recorded separately from isMo
      // above since isMo is cleared back to null on rejoin (it describes
      // their tie to batchId, not rejoinedBatchId).
      rejoinedIsMo: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
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
