const userModel = require("../../Model/userModel");

const editUser = async (req, res) => {
  const { userId, name, email, phoneNumber } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const updatedUser = await userModel.findOneAndUpdate(
      { _id: userId },
      { name, email, phoneNumber },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User updated successfully", updatedUser });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error", 
      error: error.message 
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deletedUser = await userModel.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    res.status(404).json({
      status: 404, 
      message: "Server error", 
      error: error.message 
    });
  }
};

module.exports = { editUser, deleteUser };
