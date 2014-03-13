
exports.indices = {
  // Queues have an indexed _reprocess_after
  uploads_is_a_queue: {
    collection: 'uploads',
    definition: {
      '_reprocess_after': 1,
    },
    options: {
      unique: false,
    }
  },

  base_is_a_queue: {
    collection: 'base',
    definition: {
      '_reprocess_after': 1,
    },
    options: {
      unique: false,
    }
  },

  // Derived is linked to base via base.hash = derived.base_hash
  derived_by_base_hash: {
    collection: 'derived',
    definition: {
      'base_hash': 1,
    },
    options: {
      background: true,
      unique: false,
    },
  },

  // Logs by timestamp
  logs_by_timestamp: {
    collection: 'logs',
    definition: {
      'timestamp': -1,
    },
    options: {
      background: true,
      unique: false,
    },
  },
}

exports.proto = {
  uploads: {
    hash: {type: String, index: true, unique: true},
    size: {type: Number},
    name: {type: String},
    type: {type: String},
    path: {type: String},
    email: {type: String},
    received: {type: Date},
    remote_ip: {type: String},
    _reprocess_after: {type: Number, index: true},
  },

  base: {
    email: {type: String},
    received: {type: Date},
    hash: {type: String, index: true, unique: true},
    name: {type: String},
    num_to_derive: {type: Number, index: true},
    _reprocess_after: {type: Number, index: true},
  },

  derived: {
    base_hash: {type: String, index: true, unique: false},
    path: {type: String},
    generated: {type: Date, index: true},
    params: {type: String},
  },

  notifications: {
    base_hash: {type: String},
    email: {type: String},
    type: {type: String},
    sent: {type: Date},
    _reprocess_after: {type: Number, index: true},
  }
};
