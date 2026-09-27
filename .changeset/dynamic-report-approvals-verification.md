---
'@accounter/client': patch
'@accounter/server': patch
---

Dynamic report approvals: final verification and cleanup. Types that were exported but used only
inside their own module are now module-private: `IncomingLeafApproval` and `StampApprovalsParams`
in the server's approval stamping helper, `ApprovalSnapshotLike` in the client's approval utils,
and `BaselineScope` in the client's baseline utils. Behaviour is unchanged.
