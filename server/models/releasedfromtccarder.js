"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  // Holds the MO/TMO split of trainees released (transferred) from the
  // Training Center into the production line - fed by the "Transfer to Pro
  // Line" field's split popup (see CadreDetailsCard.jsx), kept as its own
  // tile/table rather than folded into New Recruitment or Rejoined.
  class ReleasedFromTcCarder extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      ReleasedFromTcCarder.belongsTo(models.Week, {
        foreignKey: "weekId",
        as: "week",
      });
      ReleasedFromTcCarder.belongsTo(models.Factory, {
        foreignKey: "factoryId",
        as: "factory",
      });
    }
  }
  ReleasedFromTcCarder.init(
    {
      MO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      TMO: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      total: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      weekId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "weeks",
          key: "id",
        },
      },
      factoryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "factories",
          key: "id",
        },
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      batchId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "ReleasedFromTcCarder",
      tableName: "releasedfromtccarders",
      timestamps: true,
    },
  );
  return ReleasedFromTcCarder;
};
