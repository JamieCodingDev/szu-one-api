package model

import "testing"

func TestIsAssignableUserRole(t *testing.T) {
	tests := []struct {
		name string
		role int
		want bool
	}{
		{name: "guest", role: RoleGuestUser, want: false},
		{name: "student", role: RoleStudentUser, want: true},
		{name: "teacher", role: RoleTeacherUser, want: true},
		{name: "admin", role: RoleAdminUser, want: true},
		{name: "root", role: RoleRootUser, want: false},
		{name: "unknown", role: 9, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := IsAssignableUserRole(test.role); got != test.want {
				t.Fatalf("IsAssignableUserRole(%d) = %v, want %v", test.role, got, test.want)
			}
		})
	}
}
