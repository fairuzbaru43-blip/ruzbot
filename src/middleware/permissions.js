'use strict';

function hasPermission(senderId, required, config) {
  if (required === 'user') return true;
  const id = String(senderId || '').replace(/\D/g, '');
  if (!id) return false;
  if (required === 'owner') return Boolean(config.ownerId && id === config.ownerId);
  if (required === 'admin') return Boolean((config.ownerId && id === config.ownerId) || config.adminIds.includes(id));
  return false;
}

module.exports = { hasPermission };
