module.exports = function (router) {

    var Task = require('../models/task');
    var User = require('../models/user');

    function parseJSONParam(param) {
        if (param === undefined) return undefined;
        try { return JSON.parse(param); } catch (e) { return undefined; }
    }

    async function syncUserPendingTasksOnCreateOrUpdate(taskBefore, taskAfter) {
        
        if (taskBefore) {
            var wasPending = (taskBefore.completed === false);
            if (taskBefore.assignedUser && wasPending) {
                await User.updateOne(
                    { _id: taskBefore.assignedUser },
                    { $pull: { pendingTasks: String(taskBefore._id) } }
                ).exec();
            }
        }

        
        if (taskAfter) {
            var isPending = (taskAfter.completed === false);
            if (taskAfter.assignedUser && isPending) {
                await User.updateOne(
                    { _id: taskAfter.assignedUser },
                    { $addToSet: { pendingTasks: String(taskAfter._id) } }
                ).exec();
            }
        }
    }

    
    router.get('/tasks', async function (req, res) {
        try {
            var where = parseJSONParam(req.query.where) || {};
            var sort = parseJSONParam(req.query.sort) || undefined;
            var select = parseJSONParam(req.query.select) || undefined;
            var skip = req.query.skip ? parseInt(req.query.skip, 10) : undefined;
            var limit = req.query.limit ? parseInt(req.query.limit, 10) : 100; // default 100 for tasks
            var count = (String(req.query.count).toLowerCase() === 'true');

            if (count) {
                var docCount = await Task.countDocuments(where);
                return res.status(200).json({ message: 'OK', data: docCount });
            }

            var query = Task.find(where);
            if (sort) query = query.sort(sort);
            if (select) query = query.select(select);
            if (skip !== undefined) query = query.skip(skip);
            if (limit !== undefined) query = query.limit(limit);

            var tasks = await query.exec();
            return res.status(200).json({ message: 'OK', data: tasks });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.post('/tasks', async function (req, res) {
        try {
            var assignedUserId = req.body.assignedUser || "";
            var assignedUserName = 'unassigned';
            if (assignedUserId) {
                var user = await User.findById(assignedUserId).exec();
                if (!user) return res.status(400).json({ message: 'Invalid assignedUser', data: [] });
                assignedUserName = user.name || 'unassigned';
            }

            var task = new Task({
                name: req.body.name,
                description: req.body.description,
                deadline: req.body.deadline,
                completed: req.body.completed === true,
                assignedUser: assignedUserId,
                assignedUserName: assignedUserName
            });

            var saved = await task.save();

            
            await syncUserPendingTasksOnCreateOrUpdate(null, saved);

            return res.status(201).json({ message: 'Task created', data: saved });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.get('/tasks/:id', async function (req, res) {
        try {
            var select = parseJSONParam(req.query.select) || undefined;
            var query = Task.findById(req.params.id);
            if (select) query = query.select(select);
            var task = await query.exec();
            if (!task) return res.status(404).json({ message: 'Task not found', data: [] });
            return res.status(200).json({ message: 'OK', data: task });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.put('/tasks/:id', async function (req, res) {
        try {
            var taskBefore = await Task.findById(req.params.id).exec();
            if (!taskBefore) return res.status(404).json({ message: 'Task not found', data: [] });

            var assignedUserId = req.body.assignedUser || "";
            var assignedUserName = 'unassigned';
            if (assignedUserId) {
                var user = await User.findById(assignedUserId).exec();
                if (!user) return res.status(400).json({ message: 'Invalid assignedUser', data: [] });
                assignedUserName = user.name || 'unassigned';
            }

            var replacement = {
                name: req.body.name,
                description: req.body.description,
                deadline: req.body.deadline,
                completed: req.body.completed === true,
                assignedUser: assignedUserId,
                assignedUserName: assignedUserName
            };

            var updated = await Task.findByIdAndUpdate(
                req.params.id,
                replacement,
                { new: true, overwrite: true }
            ).exec();

            await syncUserPendingTasksOnCreateOrUpdate(taskBefore, updated);

            return res.status(200).json({ message: 'Task updated', data: updated });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    
    router.delete('/tasks/:id', async function (req, res) {
        try {
            var task = await Task.findByIdAndDelete(req.params.id).exec();
            if (!task) return res.status(404).json({ message: 'Task not found', data: [] });

            
            if (task.assignedUser) {
                await User.updateOne(
                    { _id: task.assignedUser },
                    { $pull: { pendingTasks: String(task._id) } }
                ).exec();
            }

            return res.status(200).json({ message: 'Task deleted', data: task });
        } catch (err) {
            return res.status(400).json({ message: 'Bad Request', data: err.message });
        }
    });

    return router;
}


