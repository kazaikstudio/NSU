const UserDetails = ({ params }: { params: { id: string } }) => {
  const { id } = params;

  return (
    <div>
      <h1>User Details for User #{id}</h1>
    </div>
  )
}

export default UserDetails