"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Factory extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // A factory is created by a user
      Factory.belongsTo(models.User, {
        foreignKey: "createdBy",
        as: "creator",
      });

      // Users assigned to this factory for daily data entry
      Factory.hasMany(models.User, {
        foreignKey: "factoryId",
        as: "users",
      });

      // A factory has many records across the carder tables
      Factory.hasMany(models.PlannedCarder, {
        foreignKey: "factoryId",
        as: "plannedCarders",
      });
      Factory.hasMany(models.AllocatedActualCarder, {
        foreignKey: "factoryId",
        as: "allocatedActualCarders",
      });
      Factory.hasMany(models.ShortageCarder, {
        foreignKey: "factoryId",
        as: "shortageCarders",
      });
      Factory.hasMany(models.AllocatedCurrentCarder, {
        foreignKey: "factoryId",
        as: "allocatedCurrentCarders",
      });
      Factory.hasMany(models.AbsenteeismCarder, {
        foreignKey: "factoryId",
        as: "absenteeismCarders",
      });
      Factory.hasMany(models.PresentCarder, {
        foreignKey: "factoryId",
        as: "presentCarders",
      });
      Factory.hasMany(models.NewRecruitCarder, {
        foreignKey: "factoryId",
        as: "newRecruitCarder",
      });
      Factory.hasMany(models.ResignedCarder, {
        foreignKey: "factoryId",
        as: "resignedCarder",
      });
      Factory.hasMany(models.RejoinedCarder, {
        foreignKey: "factoryId",
        as: "rejoinedCarder",
      });
      Factory.hasMany(models.ReleasedFromTcCarder, {
        foreignKey: "factoryId",
        as: "releasedFromTcCarder",
      });
      Factory.hasMany(models.NetCarder, {
        foreignKey: "factoryId",
        as: "netCarder",
      });
      Factory.hasMany(models.TrainingCenter, {
        foreignKey: "factoryId",
        as: "trainingCenters",
      });
      Factory.hasMany(models.Budget, {
        foreignKey: "factoryId",
        as: "budgets",
      });
      Factory.hasMany(models.Department, {
        foreignKey: "factoryId",
        as: "departments",
      });
    }
  }
  Factory.init(
    {
      factoryName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      // Enforced unique at the DB level (see the
      // add-unique-index-to-factory-code migration) as well as app-side (see
      // factoryService.assertCodeAvailable) - a deleted factory has its code
      // mangled on soft-delete (factoryService.deleteFactory) so the code is
      // freed up for reuse rather than permanently blocked.
      factoryCode: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      createdBy: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Factory",
      tableName: "factories",
      timestamps: true,
      paranoid: true,
    },
  );
  return Factory;
};
