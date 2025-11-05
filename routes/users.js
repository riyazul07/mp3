module.exports = function (router) {

    var User = require('../models/user');
    var Task = require('../models/task');

    function parseJSONParam(param) {
        if (param === undefined) return undefined;
        try { return JSON.parse(param); } catch (e) { return undefined; }
    }

    
    router.get('/users', async function (req, res) {
        try {
            var where = parseJSONParam(req.query.where) || {};
            var sort = parseJSONParam(req.query.sort) || undefined;
            var select = parseJSONParam(req.query.select) || undefined;
            var skip = req.query.skip ? parseInt(req.query.skip, 10) : undefined;
            var limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined; // unlimited by default for users
            var count = (String(req.query.count).toLowerCase() === 'true');

            if (count) {
                var docCount = await User.countDocuments(where);
                return res.status(200).json({ message: 'OK', data: docCount });
            }

            var query = User.find(where);
            if (sort) query = query.sort(sort);
            if (select) query = query.select(select);
            if (skip !== undefined) query = query.skip(skip);
            if (limit !== undefined) query = query.limit(limit);

            var users = await query.exec();
            return res.status(200).json({ message: 'OK', data: users });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.post('/users', async function (req, res) {
        try {
            var user = new User({
                name: req.body.name,
                email: req.body.email,
                pendingTasks: Array.isArray(req.body.pendingTasks) ? req.body.pendingTasks : []
            });
            var saved = await user.save();
            return res.status(201).json({ message: 'User created', data: saved });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.get('/users/:id', async function (req, res) {
        try {
            var select = parseJSONParam(req.query.select) || undefined;
            var query = User.findById(req.params.id);
            if (select) query = query.select(select);
            var user = await query.exec();
            if (!user) return res.status(404).json({ message: 'User not found', data: [] });
            return res.status(200).json({ message: 'OK', data: user });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.put('/users/:id', async function (req, res) {
        try {
            var replacement = {
                name: req.body.name,
                email: req.body.email,
                pendingTasks: Array.isArray(req.body.pendingTasks) ? req.body.pendingTasks : []
            };
            var updated = await User.findByIdAndUpdate(
                req.params.id,
                replacement,
                { new: true, overwrite: true }
            ).exec();
            if (!updated) return res.status(404).json({ message: 'User not found', data: [] });
            return res.status(200).json({ message: 'User updated', data: updated });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.delete('/users/:id', async function (req, res) {
        try {
            var user = await User.findByIdAndDelete(req.params.id).exec();
            if (!user) return res.status(404).json({ message: 'User not found', data: [] });

            
            await Task.updateMany(
                { assignedUser: req.params.id },
                { $set: { assignedUser: "", assignedUserName: "unassigned" } }
            ).exec();

            return res.status(200).json({ message: 'User deleted', data: user });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    return router;
}


