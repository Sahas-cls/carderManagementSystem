import React, { useState, useEffect } from "react";
import Card from "../../../components/ui/Card";
import CadreGroup from "./CadreGroup";
import GroupField from "./GroupField";
import Button from "../../../components/ui/Button";

// Modal component
function TransferModal({
  isOpen,
  onClose,
  data,
  onSave,
  tcTransferCount,
  hasExistingTransfer,
}) {
  const [localData, setLocalData] = useState({
    moCount: "",
    tmoCount: "",
    total: "",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (data && data.moCount !== undefined) {
        setLocalData({
          moCount: data.moCount || "",
          tmoCount: data.tmoCount || "",
          total: data.total || tcTransferCount || "",
        });
      } else {
        setLocalData({
          moCount: "",
          tmoCount: "",
          total: tcTransferCount || "",
        });
      }
      setError("");
    }
  }, [isOpen, data, tcTransferCount]);

  const handleChange = (field, value) => {
    const newData = { ...localData, [field]: value };

    if (field === "moCount" || field === "tmoCount") {
      const mo = parseInt(newData.moCount) || 0;
      const tmo = parseInt(newData.tmoCount) || 0;
      newData.total = (mo + tmo).toString();
    }

    setLocalData(newData);
    setError("");
  };

  const handleConfirm = () => {
    const mo = parseInt(localData.moCount) || 0;
    const tmo = parseInt(localData.tmoCount) || 0;
    const total = parseInt(localData.total) || 0;
    const expectedTotal = parseInt(tcTransferCount) || 0;

    if (mo + tmo !== total) {
      setError("MO + TMO must equal Total");
      return;
    }

    if (total !== expectedTotal) {
      setError(
        `Total must equal ${expectedTotal} (Transfer to Pro Line count)`,
      );
      return;
    }

    if (mo < 0 || tmo < 0 || total < 0) {
      setError("Values cannot be negative");
      return;
    }

    onSave(localData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Transfer to Production Line
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div
            className={`p-3 rounded-md mb-4 ${hasExistingTransfer ? "bg-yellow-50" : "bg-blue-50"}`}
          >
            <p className="text-sm text-gray-600">
              {hasExistingTransfer ? "Adjusting" : "Transferring"}{" "}
              <strong>{tcTransferCount || 0}</strong> trainee(s) to production
              line
            </p>
            <p className="text-xs text-gray-500 mt-1">
              These will be added to "New Recr. MO_" and "Rejoined MO_TMO"
              counts
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Machine Operators (MO)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter MO count"
              value={localData.moCount}
              onChange={(e) => handleChange("moCount", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trainee Machine Operators (TMO)
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter TMO count"
              value={localData.tmoCount}
              onChange={(e) => handleChange("tmoCount", e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total ({tcTransferCount || 0})
            </label>
            <input
              type="number"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Total"
              value={localData.total}
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Total is auto-calculated from MO + TMO
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            {hasExistingTransfer ? "Update Transfer" : "Confirm Transfer"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CadreDetailsCard({
  form,
  totals,
  onChange,
  plannedHint,
}) {
  const setField = (field) => (e) => onChange(field, e.target.value);
  const [showPopup, setShowPopup] = useState(false);

  // The "New Recr. MO_/Rejoined MO_TMO" total is always base (regular
  // recruitment/rejoin activity) + whatever the TC transfer currently
  // contributes. form.transferMO/transferTMO persist that contribution
  // (saved to the record, see cadreCalculations.js buildPayload/recordToForm)
  // so it survives a page refresh - re-opening a saved record for editing
  // recovers the exact same split it was saved with, instead of losing it to
  // component state. This also means create and edit behave identically:
  // both start from whatever transferMO/TMO the form currently carries (0
  // for a brand-new record).
  const transferMO = parseInt(form.transferMO) || 0;
  const transferTMO = parseInt(form.transferTMO) || 0;
  const hasExistingTransfer = transferMO + transferTMO > 0;

  // Handle blur event on tcTransfer field
  const handleTcTransferBlur = (e) => {
    const value = parseInt(e.target.value) || 0;
    if (value > 0) {
      setShowPopup(true);
    }
  };

  // Handle tcTransfer change
  const handleTcTransferChange = (field) => (e) => {
    const value = e.target.value;
    onChange(field, value);

    // If the user clears the transfer count, undo its contribution: fall
    // back to the base MO/TMO (before this transfer) and zero the split.
    if ((parseInt(value) || 0) === 0 && hasExistingTransfer) {
      const baseMO = (parseInt(form.newRecMO) || 0) - transferMO;
      const baseTMO = (parseInt(form.newRecTMO) || 0) - transferTMO;
      onChange("newRecMO", Math.max(0, baseMO).toString());
      onChange("newRecTMO", Math.max(0, baseTMO).toString());
      onChange("transferMO", "0");
      onChange("transferTMO", "0");
    }
  };

  const handleSaveModal = (data) => {
    const mo = parseInt(data.moCount) || 0;
    const tmo = parseInt(data.tmoCount) || 0;

    // Recover the base (non-transfer) MO/TMO by backing out whatever this
    // record's transfer currently contributes, then apply the new split on
    // top of that base - this replaces the old contribution rather than
    // piling the new one on top of it, so re-editing the same transfer
    // (including after a refresh) always lands on the correct total.
    const baseMO = (parseInt(form.newRecMO) || 0) - transferMO;
    const baseTMO = (parseInt(form.newRecTMO) || 0) - transferTMO;

    onChange("newRecMO", (baseMO + mo).toString());
    onChange("newRecTMO", (baseTMO + tmo).toString());
    onChange("transferMO", mo.toString());
    onChange("transferTMO", tmo.toString());
  };

  return (
    <>
      <TransferModal
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        data={
          hasExistingTransfer
            ? {
                moCount: transferMO.toString(),
                tmoCount: transferTMO.toString(),
                total: (transferMO + transferTMO).toString(),
              }
            : undefined
        }
        onSave={handleSaveModal}
        tcTransferCount={form.tcTransfer}
        hasExistingTransfer={hasExistingTransfer}
      />

      <Card title="Cadre / Recruitment Details">
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <CadreGroup title="Planned MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.plannedMO}
              disabled
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.plannedTMO}
              disabled
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.plannedTotal}
            />
            {plannedHint && (
              <div className="col-span-3 -mt-1 text-center text-[10px] text-orange-600">
                {plannedHint}
              </div>
            )}
          </CadreGroup>

          <CadreGroup title="Allocated_Actual MO/TMO">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.allocActualMO}
              onChange={setField("allocActualMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.allocActualTMO}
              onChange={setField("allocActualTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.allocActualTotal}
            />
          </CadreGroup>

          <CadreGroup title="Shortage MO/TMO">
            <GroupField label="MO" total readOnly value={totals.shortageMO} />
            <GroupField label="TMO" total readOnly value={totals.shortageTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.shortageTotal}
            />
          </CadreGroup>

          <CadreGroup
            variant="blue"
            title={
              <>
                New Recr. MO_
                <br />
                Rejoined MO_TMO
                <br />
                released from Tr. Cen.
              </>
            }
          >
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.newRecMO}
              onChange={setField("newRecMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.newRecTMO}
              onChange={setField("newRecTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.newRecTotal}
            />
          </CadreGroup>

          <CadreGroup
            title={
              <>
                Resigned /
                <br />
                Terminated
              </>
            }
          >
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.resignedMO}
              onChange={setField("resignedMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.resignedTMO}
              onChange={setField("resignedTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.resignedTotal}
            />
          </CadreGroup>

          <CadreGroup
            title={
              <>
                Net
                <br />
                Increase/Decrease
              </>
            }
          >
            <GroupField label="MO" total readOnly value={totals.netMO} />
            <GroupField label="TMO" total readOnly value={totals.netTMO} />
            <GroupField label="Total" total readOnly value={totals.netTotal} />
          </CadreGroup>

          <CadreGroup
            title={
              <>
                Allocated_Current
                <br />
                MO/TMO
              </>
            }
          >
            <GroupField label="MO" total readOnly value={totals.currentMO} />
            <GroupField label="TMO" total readOnly value={totals.currentTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.currentTotal}
            />
          </CadreGroup>

          <CadreGroup title="Absenteeism">
            <GroupField
              label="MO"
              type="number"
              min="0"
              value={form.absentMO}
              onChange={setField("absentMO")}
            />
            <GroupField
              label="TMO"
              type="number"
              min="0"
              value={form.absentTMO}
              onChange={setField("absentTMO")}
            />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.absentTotal}
            />
          </CadreGroup>

          <CadreGroup title="Present MO/TMO">
            <GroupField label="MO" total readOnly value={totals.presentMO} />
            <GroupField label="TMO" total readOnly value={totals.presentTMO} />
            <GroupField
              label="Total"
              total
              readOnly
              value={totals.presentTotal}
            />
          </CadreGroup>

          <CadreGroup title="TMO_Training Center" columns={4} full>
            <GroupField
              label="Planned"
              type="number"
              min="0"
              value={form.tcPlanned}
              onChange={setField("tcPlanned")}
            />
            <GroupField
              label="Allocated"
              type="number"
              min="0"
              value={form.tcAllocated}
              onChange={setField("tcAllocated")}
            />
            <GroupField
              label="Recruit."
              type="number"
              min="0"
              value={form.tcRecruit}
              onChange={setField("tcRecruit")}
            />
            <GroupField
              label="Resigned"
              type="number"
              min="0"
              value={form.tcResigned}
              onChange={setField("tcResigned")}
            />
            <GroupField
              label="Transfer to Pro Line"
              type="number"
              min="0"
              value={form.tcTransfer}
              onChange={handleTcTransferChange("tcTransfer")}
              onBlur={handleTcTransferBlur}
            />
            <GroupField
              label="Actual Allocated"
              type="number"
              min="0"
              value={form.tcActual}
              onChange={setField("tcActual")}
            />
            <GroupField
              label="Absent."
              type="number"
              min="0"
              value={form.tcAbsent}
              onChange={setField("tcAbsent")}
            />
            <GroupField
              label="Present"
              total
              readOnly
              value={totals.tcPresent}
            />
          </CadreGroup>
        </div>
      </Card>
    </>
  );
}