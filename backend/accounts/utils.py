def couple_user_ids(user):
    """IDs whose shared content this user may see: themselves + their partner."""
    ids = [user.id]
    if getattr(user, "partner_id", None):
        ids.append(user.partner_id)
    return ids
