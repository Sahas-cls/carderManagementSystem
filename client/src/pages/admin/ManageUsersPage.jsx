import { useCallback, useEffect, useState } from "react";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import Notice from "../../components/ui/Notice";
import { CountBadge } from "../../components/ui/Badge";
import useAuth from "../../hooks/useAuth";
import useNotice from "../../hooks/useNotice";
import { getFactories } from "../../services/cadreServices";
import {
  deleteUser,
  getUserRoles,
  getUsers,
  resetPassword,
  setUserStatus,
  updateUser,
} from "../../services/userServices";
import EditUserForm from "./components/EditUserForm";

export default function ManageUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, showNotice] = useNotice();
  const [reloadToken, setReloadToken] = useState(0);
  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  const [editingUser, setEditingUser] = useState(null);
  const [statusUpdatingId, setStatusUpdatingId] = useState(null);
  const [resettingId, setResettingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [resetResult, setResetResult] = useState(null); // { userName, tempPassword } - stays until dismissed
  const [copied, setCopied] = useState(false);
  const [factoryFilter, setFactoryFilter] = useState(""); // "" = every factory, "none" = unassigned users only, else a factory id

  const filteredUsers = users.filter((u) => {
    if (!factoryFilter) return true;
    if (factoryFilter === "none") return !u.factoryId;
    return String(u.factoryId) === factoryFilter;
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [userList, roleList, factoryList] = await Promise.all([
          getUsers(),
          getUserRoles(),
          getFactories(),
        ]);
        if (!cancelled) {
          setUsers(userList);
          setRoles(roleList);
          setFactories(factoryList);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const handleToggleStatus = async (targetUser) => {
    setStatusUpdatingId(targetUser.id);
    try {
      await setUserStatus(targetUser.id, !targetUser.isActive);
      showNotice(
        `${targetUser.userName} ${targetUser.isActive ? "deactivated" : "activated"}.`,
        "ok",
      );
      refetch();
    } catch (err) {
      showNotice(err.message, "err");
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleEditSubmit = async (updates) => {
    await updateUser(editingUser.id, updates);
    setEditingUser(null);
    showNotice("User updated.", "ok");
    refetch();
  };

  const handleResetPassword = async (targetUser) => {
    if (
      !window.confirm(
        `Reset the password for ${targetUser.userName}? Their current password will stop working.`,
      )
    ) {
      return;
    }
    setResettingId(targetUser.id);
    try {
      const { tempPassword } = await resetPassword(targetUser.id);
      setResetResult({ userName: targetUser.userName, tempPassword });
      setCopied(false);
    } catch (err) {
      showNotice(err.message, "err");
    } finally {
      setResettingId(null);
    }
  };

  const handleDelete = async (targetUser) => {
    if (
      !window.confirm(
        `Permanently delete ${targetUser.userName} (${targetUser.email})? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(targetUser.id);
    try {
      await deleteUser(targetUser.id);
      showNotice(`${targetUser.userName} deleted.`, "ok");
      refetch();
    } catch (err) {
      showNotice(err.message, "err");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(resetResult.tempPassword);
      setCopied(true);
    } catch {
      // Clipboard API may be unavailable (e.g. insecure context) - the password is still on screen to copy manually.
    }
  };

  return (
    <div>
      <Notice message={notice?.message} type={notice?.type} />
      {error && (
        <Notice message={`Failed to load users: ${error}`} type="err" />
      )}

      {resetResult && (
        <Card title="Password Reset" variant="orange">
          <div className="p-4 flex flex-col gap-3">
            <p className="text-sm text-app-text">
              New temporary password for <b>{resetResult.userName}</b> — share
              it with them now, it won&apos;t be shown again:
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="bg-slate-100 border border-slate-300 rounded-md px-3 py-2 text-sm font-mono">
                {resetResult.tempPassword}
              </code>
              <Button small onClick={handleCopyTempPassword}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button small variant="edit" onClick={() => setResetResult(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Card>
      )}

      {editingUser && (
        <EditUserForm
          user={editingUser}
          roles={roles}
          factories={factories}
          onSubmit={handleEditSubmit}
          onCancel={() => setEditingUser(null)}
        />
      )}

      <Card
        title="Manage Users"
        variant="navy"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs font-normal text-white">
              Factory:
              <select
                value={factoryFilter}
                onChange={(e) => setFactoryFilter(e.target.value)}
                className="rounded border border-white/40 bg-white/10 px-1.5 py-0.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-white [color-scheme:dark] text-red-300"
              >
                <option value="" className="text-black">
                  All Factories
                </option>
                {factories.map((f) => (
                  <option
                    key={f.id}
                    value={String(f.id)}
                    className="text-black"
                  >
                    {f.factoryName}
                  </option>
                ))}
                <option value="none" className="text-black">
                  Unassigned
                </option>
              </select>
            </label>
            <CountBadge>
              {filteredUsers.length} user{filteredUsers.length === 1 ? "" : "s"}
            </CountBadge>
          </div>
        }
      >
        <div className="p-4 overflow-auto">
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-10">
              Loading users…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-10">
              {users.length === 0
                ? "No users found."
                : "No users match this filter."}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-app-muted border-b border-app-border">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Factory</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Last Login</th>
                  <th className="py-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="border-b border-app-border/60">
                      <td className="py-2.5 pr-3 font-medium text-app-text">
                        {u.userName}
                        {isSelf && (
                          <span className="text-app-muted font-normal">
                            {" "}
                            (you)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-app-muted">{u.email}</td>
                      <td className="py-2.5 pr-3 text-app-muted">
                        {u.role?.userRole || "-"}
                      </td>
                      <td className="py-2.5 pr-3 text-app-muted">
                        {u.factory?.factoryName || "-"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                            u.isActive
                              ? "bg-green-soft text-green-dark"
                              : "bg-orange-soft text-[#89511d]"
                          }`}
                        >
                          {u.isActive ? "Active" : "Pending activation"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-app-muted whitespace-nowrap">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString()
                          : "Never"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <Button
                            small
                            variant="edit"
                            onClick={() => setEditingUser(u)}
                          >
                            Edit
                          </Button>
                          {!isSelf && (
                            <Button
                              small
                              variant={u.isActive ? "delete" : "teal"}
                              onClick={() => handleToggleStatus(u)}
                              disabled={statusUpdatingId === u.id}
                            >
                              {statusUpdatingId === u.id
                                ? "Working…"
                                : u.isActive
                                  ? "Deactivate"
                                  : "Activate"}
                            </Button>
                          )}
                          <Button
                            small
                            variant="orange"
                            onClick={() => handleResetPassword(u)}
                            disabled={resettingId === u.id}
                          >
                            {resettingId === u.id
                              ? "Resetting…"
                              : "Reset Password"}
                          </Button>
                          {!isSelf && (
                            <Button
                              small
                              variant="delete"
                              onClick={() => handleDelete(u)}
                              disabled={deletingId === u.id}
                            >
                              {deletingId === u.id ? "Deleting…" : "Delete"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
